import {
  ConfigManager,
  getParser,
  getStringifier,
  loadConfigurationFile,
  saveConfigurationFile
} from '@platformatic/config'
import { ensureLoggableError, loadModule, safeRemove } from '@platformatic/utils'
import jsonPatch from 'fast-json-patch'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import {
  buildRuntime,
  findRuntimeConfigurationFile,
  getRoot,
  loadConfigurationFileAsConfig,
  logFatalError,
  parseArgs
} from '../utils.js'

async function patchFile (path, patch) {
  let config = getParser(path)(await readFile(path, 'utf-8'))
  config = jsonPatch.applyPatch(config, patch).newDocument
  await writeFile(path, getStringifier(path)(config))
}

export async function patchConfig (logger, configurationFile, patchPath) {
  let runtime
  try {
    // Determine if the configuration file is for a service or a runtime
    const config = await loadConfigurationFileAsConfig(logger, configurationFile)
    const isService = config.configType !== 'runtime'

    const patchFunction = await loadModule(createRequire(configurationFile), patchPath)

    if (typeof patchFunction !== 'function') {
      throw new Error('Patch file must export a function.')
    }

    // Create the runtime
    runtime = await buildRuntime(logger, configurationFile)

    /* c8 ignore next 3 - Hard to test */
    if (!runtime) {
      return
    }

    // Prepare the structure for original and modified configurations files
    const original = {
      runtime: getParser(configurationFile)(await readFile(configurationFile, 'utf-8')),
      services: {}
    }

    const loaded = {
      runtime: runtime.getRuntimeConfig(),
      services: {}
    }

    const services = Object.fromEntries(loaded.runtime.services.map(service => [service.id, service]))

    // Load configuration for all services
    for (const service of loaded.runtime.services) {
      if (!service.config) {
        const candidate = ConfigManager.listConfigFiles().find(f => existsSync(resolve(service.path, f)))

        if (candidate) {
          service.config = resolve(service.path, candidate)
        }
      }

      const { id, config } = service
      const parser = getParser(config)

      original.services[id] = parser(await readFile(configurationFile, 'utf-8'))
      loaded.services[id] = await runtime.getServiceConfig(id, false)
    }

    // Execute the patch function
    const patches = await patchFunction(runtime, services, loaded, original)

    // Apply patches
    if (typeof patches !== 'object') {
      return
    }

    if (Array.isArray(patches.runtime)) {
      if (isService) {
        // Create a temporary file with existing configuration
        const temporaryDir = await mkdtemp(resolve(tmpdir(), 'wattpm-patch-'))
        const temporaryFile = resolve(temporaryDir, 'watt.json')

        try {
          /* c8 ignore next - Else branch */
          await saveConfigurationFile(temporaryFile, original.runtime.runtime ?? {})
          await patchFile(temporaryFile, patches.runtime)
          await patchFile(configurationFile, [
            { op: 'replace', path: '/runtime', value: await loadConfigurationFile(temporaryFile) }
          ])
        } finally {
          await safeRemove(temporaryDir)
        }
      } else {
        await patchFile(configurationFile, patches.runtime)
      }
    }

    if (typeof patches.services === 'object') {
      for (const [id, patch] of Object.entries(patches.services)) {
        const config = services[id].config

        if (Array.isArray(patch)) {
          await patchFile(config, patch)
        }
      }
    }
  } finally {
    await runtime?.close?.(true)
  }
}

export async function patchConfigCommand (logger, args) {
  const {
    values: { config },
    positionals
  } = parseArgs(
    args,
    {
      config: {
        type: 'string',
        short: 'c'
      }
    },
    false
  )

  let root
  let patch

  /*
    One argument = patch file
    Two arguments = root and patch file
  */

  /* c8 ignore next 7 */
  if (positionals.length === 1) {
    root = getRoot()
    patch = positionals[0]
  } else {
    root = getRoot(positionals)
    patch = positionals[1]
  }

  const configurationFile = await findRuntimeConfigurationFile(logger, root, config)

  /* c8 ignore next 3 */
  if (!configurationFile) {
    return
  }

  try {
    await patchConfig(logger, configurationFile, patch)
  } catch (error) {
    return logFatalError(
      logger,
      { err: ensureLoggableError(error) },
      `Patching configuration has throw an exception: ${error.message}`
    )
  }

  logger.done('Patch executed correctly.')
}

export const help = {
  'patch-config': {
    usage: 'patch-config [root] [patch]',
    description: 'Applies a patch file to the runtime and services configurations.',
    args: [
      {
        name: 'root',
        description:
          'The process ID of the application (it can be omitted only if there is a single application running)'
      },
      {
        name: 'patch',
        description: 'The file containing the patch to execute.'
      }
    ],
    options: [
      {
        usage: '-c, --config <config>',
        description: 'Name of the configuration file to use (the default is watt.json)'
      }
    ]
  }
}
