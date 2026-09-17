import {
  listRecognizedConfigurationFiles,
  NoConfigFileFoundError,
  findConfigurationFile as utilsFindConfigurationFile
} from '@platformatic/foundation'
import jsonPatch from 'fast-json-patch'
import { stat } from 'node:fs/promises'
import { dirname, resolve as resolvePath } from 'node:path'
import { workerData } from 'node:worker_threads'

export async function findConfigurationFile (root, suffixes) {
  const file = await utilsFindConfigurationFile(root, suffixes)

  if (!file) {
    const err = new NoConfigFileFoundError()
    err.message = `No config file found in the directory ${root}. Please create one of the following files: ${listRecognizedConfigurationFiles(suffixes, ['json']).join(', ')}`

    throw err
  }

  return resolvePath(root, file)
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
