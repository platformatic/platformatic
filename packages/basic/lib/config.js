import {
  listRecognizedConfigurationFiles,
  NoConfigFileFoundError,
  findConfigurationFile as utilsFindConfigurationFile
} from '@platformatic/utils'
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
  const patch = workerData?.serviceConfig?.configPatch

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

  return config
}

export const validationOptions = {
  useDefaults: true,
  coerceTypes: true,
  allErrors: true,
  strict: false
}
