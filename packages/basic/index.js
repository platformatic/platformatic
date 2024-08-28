import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { relative, resolve } from 'node:path'
import { workerData } from 'node:worker_threads'
import pino from 'pino'
import { packageJson, schema } from './lib/schema.js'
import { importFile } from './lib/utils.js'

async function importStackablePackage (opts, pkg, autodetectDescription) {
  try {
    try {
      // Try regular import
      return await import(pkg)
    } catch (e) {
      // Scope to the service
      const require = createRequire(resolve(opts.context.directory, 'index.js'))
      const imported = require.resolve(pkg)
      return await importFile(imported)
    }
  } catch (e) {
    const rootFolder = relative(process.cwd(), workerData.dirname)

    let errorMessage = `Unable to import package, "${pkg}". Please add it as a dependency `

    if (rootFolder) {
      errorMessage += `in the package.json file in the folder ${rootFolder}.`
    } else {
      errorMessage += 'in the root package.json file.'
    }

    throw new Error(errorMessage)
  }
}

async function buildStackable (opts) {
  const root = opts.context.directory
  let toImport = '@platformatic/node'
  let autodetectDescription = 'is using a generic Node.js application'

  let rootPackageJson
  try {
    rootPackageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8'))
  } catch {
    rootPackageJson = {}
  }

  const hadConfig = opts.config

  if (!hadConfig) {
    const candidate = resolve(root, 'platformatic.application.json')

    if (existsSync(candidate)) {
      opts.config = candidate
    }
  }

  const { dependencies, devDependencies } = rootPackageJson

  if (dependencies?.next || devDependencies?.next) {
    autodetectDescription = 'is using Next.js'
    toImport = '@platformatic/next'
  } else if (dependencies?.['@remix-run/dev'] || devDependencies?.['@remix-run/dev']) {
    autodetectDescription = 'is using Remix'
    toImport = '@platformatic/remix'
  } else if (dependencies?.vite || devDependencies?.vite) {
    autodetectDescription = 'is using Vite'
    toImport = '@platformatic/vite'
  } else if (dependencies?.astro || devDependencies?.astro) {
    autodetectDescription = 'is using Astro'
    toImport = '@platformatic/astro'
  }

  const imported = await importStackablePackage(opts, toImport, autodetectDescription)

  const serviceRoot = relative(process.cwd(), opts.context.directory)
  if (!hadConfig && !existsSync(resolve(serviceRoot, 'platformatic.application.json'))) {
    const logger = pino({
      level: opts.context.serverConfig?.logger?.level ?? 'warn',
      name: opts.context.serviceId
    })

    logger.warn(
      [
        `Platformatic has auto-detected that service ${opts.context.serviceId} ${autodetectDescription}.\n`,
        `We suggest you create a platformatic.application.json file in the folder ${serviceRoot} with the "$schema" `,
        `property set to "https://schemas.platformatic.dev/${toImport}/${packageJson.version}.json".`
      ].join('')
    )
  }

  return imported.buildStackable(opts)
}

/* c8 ignore next 3 */
export function transformConfig () {
  // This is currently empty but it left as a placeholder for the future
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
export * from './lib/worker/server-listener.js'
