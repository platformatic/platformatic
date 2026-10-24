import { ensureLoggableError } from '@platformatic/foundation'
import { client as metricsClient } from '@platformatic/metrics'
import { createRequire } from 'node:module'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  FailedToLoadExtensionError,
  FailedToStartExtensionError,
  FailedToStopExtensionError,
  InvalidExtensionConfigureError,
  InvalidExtensionError
} from './errors.js'

async function importExtension (path) {
  try {
    return await import(pathToFileURL(path))
  } catch (error) {
    throw new FailedToLoadExtensionError(path, error.message, { cause: error })
  }
}

function resolveExtensionSetup (imported) {
  const candidates = [imported?.default, imported?.setup, imported?.default?.default, imported?.default?.setup]

  for (const candidate of candidates) {
    if (typeof candidate === 'function') {
      return candidate
    }
  }

  return null
}

export function resolveExtensions (config, { root, build }) {
  const extensions = config.extensions
    ? [...(Array.isArray(config.extensions) ? config.extensions : [config.extensions])]
    : []
  const enabled = []

  // Retain resolved paths in the configuration so configure and setup import the same module.
  for (let index = 0; index < extensions.length; index++) {
    const extension = extensions[index]
    const entry = typeof extension === 'string' ? { path: extension } : extension

    if (build && !entry.build) {
      continue
    }

    try {
      const path = entry.path.startsWith('npm:')
        ? createRequire(join(root, 'package.json')).resolve(entry.path.slice(4))
        : resolve(root, entry.path)
      extensions[index] = typeof extension === 'string' ? path : { ...entry, path }
      enabled.push({ ...entry, path, options: entry.options ?? {} })
    } catch (error) {
      throw new FailedToLoadExtensionError(entry.path, error.message, { cause: error })
    }
  }

  if (config.extensions) {
    config.extensions = Array.isArray(config.extensions) ? [...extensions] : extensions[0]
  }

  return enabled
}

export async function configureExtensions (config, extensions, { root }) {
  for (const { path, options } of extensions) {
    const imported = await importExtension(path)
    try {
      const configure = imported.configure !== undefined ? imported.configure : imported.default?.configure

      if (configure === undefined) {
        continue
      }

      if (typeof configure !== 'function') {
        throw new InvalidExtensionConfigureError(path)
      }

      await configure(config, { root, options })
    } catch (error) {
      throw new FailedToLoadExtensionError(path, error.message, { cause: error })
    }
  }
}

export async function loadExtensions (extensions, instances, { logger, createContext }) {
  for (const { path, options } of extensions) {
    const imported = await importExtension(path)
    const setup = resolveExtensionSetup(imported)

    if (typeof setup !== 'function') {
      throw new InvalidExtensionError(path)
    }

    const extensionLogger = logger.child({ name: `extension:${basename(path)}` })
    // One registry per extension isolates metric conflicts and cleanup.
    const registry = new metricsClient.Registry()
    const metrics = { client: metricsClient, registry }
    let context

    try {
      context = createContext({ path, options, logger: extensionLogger, metrics })
      const instance = await setup(context)
      instances.push({ path, instance, registry, health: context.health, started: false, stopped: false, closed: false })
    } catch (error) {
      registry.clear()
      context?.health?.cleanup()
      throw new FailedToLoadExtensionError(path, error.message, { cause: error })
    }
  }
}

export async function startExtensions (extensions) {
  for (const extension of extensions) {
    if (extension.started) {
      continue
    }

    try {
      await extension.instance?.start?.()
      extension.started = true
    } catch (error) {
      throw new FailedToStartExtensionError(extension.path, error.message, { cause: error })
    }
  }
}

export async function stopExtensions (extensions, logger) {
  // Stop only successfully started extensions, in reverse dependency order.
  for (const extension of [...extensions].reverse()) {
    if (!extension.started || extension.stopped) {
      continue
    }

    // Mark before invoking so repeated stop remains idempotent even if the hook throws.
    extension.stopped = true

    try {
      await extension.instance?.stop?.()
    } catch (error) {
      const err = new FailedToStopExtensionError(extension.path, error.message, { cause: error })
      logger.error({ err: ensureLoggableError(err) }, `Failed to stop the extension "${extension.path}".`)
    }
  }
}

export async function closeExtensions (instances, logger) {
  // Drain before invoking hooks so repeated close is idempotent.
  const extensions = instances.splice(0).reverse()

  for (const extension of extensions) {
    if (extension.closed) {
      continue
    }

    extension.closed = true

    try {
      await extension.instance?.close?.()
    } catch (error) {
      logger.error({ err: ensureLoggableError(error) }, `Failed to close the extension "${extension.path}".`)
    } finally {
      extension.health?.cleanup?.()
    }

    // Metrics remain available through close and are removed even when the hook fails.
    try {
      extension.registry?.clear()
    } catch (error) {
      logger.error({ err: ensureLoggableError(error) }, `Failed to clear metrics registry for extension "${extension.path}".`)
    }
  }
}
