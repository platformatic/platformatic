import { detectApplicationType, findConfigurationFile } from '@platformatic/utils'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { relative, resolve } from 'node:path'
import { workerData } from 'node:worker_threads'
import pino from 'pino'
import { packageJson } from './schema.js'
import { importFile } from './utils.js'

const importStackablePackageMarker = '__pltImportStackablePackage.js'

export function isImportFailedError (error, pkg) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' && error.code !== 'MODULE_NOT_FOUND') {
    return false
  }

  const match = error.message.match(/Cannot find package '(.+)' imported from (.+)/)

  return match?.[1] === pkg || error.requireStack?.[0].endsWith(importStackablePackageMarker)
}

export async function importStackablePackage (directory, pkg) {
  let imported
  try {
    try {
      // Try regular import
      imported = await import(pkg)
    } catch (e) {
      if (!isImportFailedError(e, pkg)) {
        throw e
      }

      // Scope to the service
      const require = createRequire(resolve(directory, importStackablePackageMarker))
      const toImport = require.resolve(pkg)
      imported = await importFile(toImport)
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

  return imported.default ?? imported
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
    config = await findConfigurationFile(root, 'application')
  }

  const appType = await detectApplicationType(root, rootPackageJson)

  if (!appType) {
    throw new Error(`Unable to detect application type in ${root}.`)
  }

  const { label, name: moduleName } = appType

  if (context) {
    const serviceRoot = relative(process.cwd(), root)

    if (!hadConfig && context.serviceId && !(await findConfigurationFile(root)) && context.worker?.index === 0) {
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
