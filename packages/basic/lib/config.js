import { ConfigManager, errors } from '@platformatic/config'
import jsonPatch from 'fast-json-patch'
import { stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { workerData } from 'node:worker_threads'

export async function findConfigurationFile (root, typeOrCandidates) {
  const file = await ConfigManager.findConfigFile(root, typeOrCandidates)

  if (!file) {
    const err = new errors.NoConfigFileFoundError()
    err.message = `No config file found in the directory ${root} or its parents. Please create one of the following files: ${ConfigManager.listConfigFiles(typeOrCandidates, false, ['json']).join(', ')}`

    throw err
  }

  return resolve(root, file)
}

export async function resolveStackable (fileOrDirectory, sourceOrConfig, typeOrCandidates) {
  if (sourceOrConfig && typeof sourceOrConfig !== 'string') {
    return {
      root: fileOrDirectory,
      source: sourceOrConfig
    }
  } else if (typeof fileOrDirectory === 'string' && typeof sourceOrConfig === 'string') {
    return {
      root: fileOrDirectory,
      source: sourceOrConfig
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
    source: await findConfigurationFile(fileOrDirectory, typeOrCandidates)
  }
}

export async function createConfigManager (configuration, root, source, opts, context) {
  const { schema, upgrade, config, version } = configuration

  const configManager = new ConfigManager({
    schema: opts.context.schema ?? schema,
    source,
    upgrade,
    version,
    ...config,
    ...opts.context.configManagerConfig,
    dirname: root,
    context
  })

  await configManager.parseAndValidate()
  return configManager
}

export async function transformConfig () {
  const patch = workerData?.serviceConfig?.configPatch

  if (Array.isArray(patch)) {
    this.current = jsonPatch.applyPatch(this.current, patch).newDocument
  }

  if (!this.current) {
    return
  }

  if (this.current.watch === undefined) {
    this.current.watch = { enabled: workerData?.config?.watch ?? false }
  } else if (typeof this.current.watch !== 'object') {
    this.current.watch = { enabled: this.current.watch || false }
  }
}

export const schemaOptions = {
  useDefaults: true,
  coerceTypes: true,
  allErrors: true,
  strict: false
}
