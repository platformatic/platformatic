import { createRequire } from '@platformatic/utils'
import jsonPatch from 'fast-json-patch'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { workerData } from 'node:worker_threads'
import pino from 'pino'
import { packageJson, schema } from './lib/schema.js'
import { importFile } from './lib/utils.js'

const importStackablePackageMarker = '__pltImportStackablePackage.js'

export const configCandidates = [
  'platformatic.application.json',
  'platformatic.json',
  'watt.json',
  'platformatic.application.yaml',
  'platformatic.yaml',
  'watt.yaml',
  'platformatic.application.yml',
  'platformatic.yml',
  'watt.yml',
  'platformatic.application.toml',
  'platformatic.toml',
  'watt.toml',
  'platformatic.application.tml',
  'platformatic.tml',
  'watt.tml'
]

function hasDependency (packageJson, dependency) {
  return packageJson.dependencies?.[dependency] || packageJson.devDependencies?.[dependency]
}

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

export function detectStackable (packageJson) {
  let name = '@platformatic/node'
  let label = 'Node.js'

  if (hasDependency(packageJson, '@nestjs/core')) {
    name = '@platformatic/nest'
    label = 'NestJS'
  } else if (hasDependency(packageJson, 'next')) {
    name = '@platformatic/next'
    label = 'Next.js'
  } else if (hasDependency(packageJson, '@remix-run/dev')) {
    name = '@platformatic/remix'
    label = 'Remix'
  } else if (hasDependency(packageJson, 'astro')) {
    name = '@platformatic/astro'
    label = 'Astro'
    // Since Vite is often used with other frameworks, we must check for Vite last
  } else if (hasDependency(packageJson, 'vite')) {
    name = '@platformatic/vite'
    label = 'Vite'
  }

  return { name, label }
}

export async function importStackableAndConfig (root, config) {
  let rootPackageJson
  try {
    rootPackageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8'))
  } catch {
    rootPackageJson = {}
  }

  if (!config) {
    for (const candidate of configCandidates) {
      const candidatePath = resolve(root, candidate)

      if (existsSync(candidatePath)) {
        config = candidatePath
        break
      }
    }
  }

  const { label, name: moduleName } = detectStackable(rootPackageJson)
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
  const { stackable, config, autodetectDescription, moduleName } = await importStackableAndConfig(
    opts.context.directory,
    opts.config
  )
  opts.config = config

  const serviceRoot = relative(process.cwd(), opts.context.directory)
  if (
    !hadConfig &&
    !existsSync(resolve(serviceRoot, 'platformatic.json') || existsSync(resolve(serviceRoot, 'watt.json'))) &&
    opts.context.worker?.count > 1
  ) {
    const logger = pino({
      level: opts.context.serverConfig?.logger?.level ?? 'warn',
      name: opts.context.serviceId
    })

    logger.warn(
      [
        `Platformatic has auto-detected that service "${opts.context.serviceId}" ${autodetectDescription}.\n`,
        `We suggest you create a platformatic.json or watt.json file in the folder ${serviceRoot} with the "$schema" `,
        `property set to "https://schemas.platformatic.dev/${moduleName}/${packageJson.version}.json".`
      ].join('')
    )
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
