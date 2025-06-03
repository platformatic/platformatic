import { ConfigManager } from '@platformatic/config'
import { detectApplicationType } from '@platformatic/utils'
import jsonPatch from 'fast-json-patch'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { relative, resolve } from 'node:path'
import { workerData } from 'node:worker_threads'
import pino from 'pino'
import { packageJson, schema } from './lib/schema.js'
import { importFile } from './lib/utils.js'

const importStackablePackageMarker = '__pltImportStackablePackage.js'

function isImportFailedError (error, pkg) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' && error.code !== 'MODULE_NOT_FOUND') {
    return false
  }

  const match = error.message.match(/Cannot find package '(.+)' imported from (.+)/)

  return match?.[1] === pkg || error.requireStack?.[0].endsWith(importStackablePackageMarker)
}

async function importStackablePackage (directory, pkg) {
  try {
    try {
      // Try regular import
      return await import(pkg)
    } catch (e) {
      if (!isImportFailedError(e, pkg)) {
        throw e
      }

      // Scope to the service
      const require = createRequire(resolve(directory, importStackablePackageMarker))
      const imported = require.resolve(pkg)
      return await importFile(imported)
    }
  } catch (e) {
    if (!isImportFailedError(e, pkg)) {
      throw e
    }

    const serviceDirectory = workerData ? relative(workerData.dirname, directory) : directory
    throw new Error(
      `Unable to import package '${pkg}'. Please add it as a dependency in the package.json file in the folder ${serviceDirectory}.`
    )
  }
}

export async function importStackableAndConfig (root, config, context) {
  let rootPackageJson
  try {
    rootPackageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8'))
  } catch {
    rootPackageJson = {}
  }

  const hadConfig = !!config

  if (!config) {
    config = await ConfigManager.findConfigFile(root, 'application')
  }

  const { label, name: moduleName } = await detectApplicationType(root, rootPackageJson)

  if (context) {
    const serviceRoot = relative(process.cwd(), root)

    if (!hadConfig && context.serviceId && !(await ConfigManager.findConfigFile(root)) && context.worker?.index === 0) {
      const autodetectDescription =
        moduleName === '@platformatic/node' ? 'is a generic Node.js application' : `is using ${label}`

      const logger = pino({ level: context.serverConfig?.logger?.level ?? 'warn', name: context.serviceId })

      logger.warn(`We have auto-detected that service "${context.serviceId}" ${autodetectDescription}.`)
      logger.warn(
        `We suggest you create a watt.json or a platformatic.json file in the folder ${serviceRoot} with the "$schema" property set to "https://schemas.platformatic.dev/${moduleName}/${packageJson.version}.json".`
      )
      logger.warn(`Also don't forget to add "${moduleName}" to the service dependencies.`)
      logger.warn('You can also run "wattpm import" to do this automatically.\n')
    }
  }

  const stackable = await importStackablePackage(root, moduleName)

  return {
    stackable,
    config,
    autodetectDescription:
      moduleName === '@platformatic/node' ? 'is a generic Node.js application' : `is using ${label}`,
    moduleName
  }
}

async function buildStackable (opts) {
  const hadConfig = !!opts.config
  const { stackable, config } = await importStackableAndConfig(opts.context.directory, opts.config, opts.context)
  opts.config = config

  if (!hadConfig && typeof stackable.createDefaultConfig === 'function') {
    opts.config = await stackable.createDefaultConfig?.(opts)
  }

  return stackable.buildStackable(opts)
}

/* c8 ignore next 3 */
export async function transformConfig () {
  const patch = workerData?.serviceConfig?.configPatch

  if (Array.isArray(patch)) {
    this.current = jsonPatch.applyPatch(this.current, patch).newDocument
  }
}

export const schemaOptions = {
  useDefaults: true,
  coerceTypes: true,
  allErrors: true,
  strict: false
}

export default {
  configType: 'nodejs',
  configManagerConfig: {
    schemaOptions,
    transformConfig
  },
  buildStackable,
  schema,
  version: packageJson.version
}

export * from './lib/base.js'
export * as errors from './lib/errors.js'
export { schema, schemaComponents } from './lib/schema.js'
export * from './lib/utils.js'
export * from './lib/worker/child-manager.js'
export * from './lib/worker/listeners.js'
