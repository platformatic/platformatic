import {
  listRecognizedConfigurationFiles,
  loadConfiguration as utilsLoadConfiguration,
  NoConfigFileFoundError,
  findConfigurationFile as utilsFindConfigurationFile
} from '@platformatic/foundation'
import {
  configurationFileNames,
  isConfigurationFileName,
  loadApplicationConfigurationFile
} from '@platformatic/foundation/lib/v4/index.js'
import jsonPatch from 'fast-json-patch'
import { stat } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import { workerData } from 'node:worker_threads'

export async function findConfigurationFile (root, suffixes) {
  /*
    v4 first, and by the same four names everywhere. A directory holding a `watt.config.ts` and no
    v3 document would otherwise be reported as having no configuration at all -- which is what a
    capability booted directly in a converted project would have been told.
  */
  const v4 = await utilsFindConfigurationFile(root, null, null, configurationFileNames)

  if (v4) {
    return resolvePath(root, v4)
  }

  const file = await utilsFindConfigurationFile(root, suffixes)

  if (!file) {
    const err = new NoConfigFileFoundError()
    err.message = `No config file found in the directory ${root}. Please create one of the following files: ${[...configurationFileNames, ...listRecognizedConfigurationFiles(suffixes, ['json'])].join(', ')}`

    throw err
  }

  return resolvePath(root, file)
}

/*
  A capability's configuration, however it was named.

  The runtime hands over an object it has already resolved -- evaluated once, main-side, and
  validated against this capability's schema -- and `resolved` in the context says so. A person or a
  test hands over a file instead, and a v4 file is a program: there is no document to parse, so it
  is evaluated by the same loader a boot uses and the answer is the one a boot would produce. Both
  forms arrive here as data, and what is left in either case is the capability's own transform and
  the metadata it reads its root from.
*/
export async function loadCapabilityConfiguration (configOrRoot, sourceOrConfig, context, capability) {
  const { schema, suffixes, scope, ...options } = capability
  const { root, source } = await resolve(configOrRoot, sourceOrConfig, suffixes)

  if (typeof source === 'string' && isConfigurationFileName(basename(source))) {
    const application = await loadApplicationConfigurationFile(source, {
      mode: context?.mode,
      production: context?.production ?? context?.isProduction,
      /*
        The capability's own position is the fallback for resolving its schema. The loader's default
        is foundation's, which depends on no capability by construction -- so an application that
        does not carry the capability in its own dependencies, which is every fixture a capability
        boots directly, could not be validated at all.
      */
      runtimeScope: scope
    })

    return utilsLoadConfiguration(application.config, context?.schema ?? schema, {
      ...options,
      root: application.root,
      env: application.env,
      ...context,
      // Not overridable by the caller: this configuration was resolved a moment ago, by the loader.
      resolved: true
    })
  }

  return utilsLoadConfiguration(source, context?.schema ?? schema, { ...options, root, ...context })
}

export async function resolve (fileOrDirectory, sourceOrConfig, suffixes) {
  if (sourceOrConfig && typeof sourceOrConfig !== 'string') {
    return {
      root: fileOrDirectory,
      source: sourceOrConfig
    }
  } else if (typeof fileOrDirectory === 'string' && typeof sourceOrConfig === 'string') {
    return {
      root: fileOrDirectory,
      source: resolvePath(fileOrDirectory, sourceOrConfig)
    }
  }

  try {
    const fileInfo = await stat(fileOrDirectory)

    if (fileInfo.isFile()) {
      return {
        root: dirname(fileOrDirectory),
        source: fileOrDirectory
      }
    }
  } catch {
    // No-op
  }

  return {
    root: fileOrDirectory,
    source: await findConfigurationFile(fileOrDirectory, suffixes)
  }
}

export async function transform (config) {
  const patch = workerData?.applicationConfig?.configPatch

  if (!config) {
    return config
  }

  if (Array.isArray(patch)) {
    config = jsonPatch.applyPatch(config, patch).newDocument
  }

  if (config.watch === undefined) {
    config.watch = { enabled: workerData?.config?.watch ?? false }
  } else if (typeof config.watch !== 'object') {
    config.watch = { enabled: config.watch || false }
  }

  applyPortAssignment(config.server, workerData?.worker)

  return config
}

// When server.portAssignment is set to perWorkerIncrement, each worker of the application listens on its own port:
// worker with port offset N (which is the worker index unless the worker replaced another one) listens on port + N.
export function applyPortAssignment (serverConfig, worker) {
  if (serverConfig?.portAssignment !== 'perWorkerIncrement') {
    return serverConfig
  }

  const port = Number(serverConfig.port)
  const offset = worker?.portOffset ?? worker?.index ?? 0

  if (Number.isInteger(port) && port > 0 && Number.isInteger(offset) && offset > 0) {
    serverConfig.port = port + offset
  }

  return serverConfig
}

export const validationOptions = {
  useDefaults: true,
  coerceTypes: true,
  allErrors: true,
  strict: false
}
