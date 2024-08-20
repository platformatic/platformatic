import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { workerData } from 'node:worker_threads'
import { packageJson, schema } from './lib/schema.js'

async function importStackablePackage (opts, pkg, autodetectDescription) {
  try {
    return await import(pkg)
  } catch (e) {
    const rootFolder = relative(process.cwd(), workerData.dirname)

    let errorMessage = `Unable to import package, "${pkg}". Please add it as a dependency `

    if (rootFolder) {
      errorMessage += `in the package.json file in the folder ${rootFolder}.`
    } else {
      errorMessage += 'in the root package.json file.'
    }

    if (!opts.config) {
      const serviceRoot = relative(process.cwd(), opts.context.directory)
      errorMessage += [
        '', // Do not remove this
        `Platformatic has auto-detected that service ${opts.context.serviceId} ${autodetectDescription}.`,
        `We suggest you create a platformatic.application.json file in the folder ${serviceRoot} with the "$schema" property set to "https://schemas.platformatic.dev/${pkg}/${packageJson.version}.json".`,
      ].join('\n')
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

  if (!opts.config) {
    const candidate = resolve(root, 'platformatic.application.json')

    if (existsSync(candidate)) {
      opts.config = candidate
    }
  }

  const { dependencies, devDependencies } = rootPackageJson

  if (dependencies?.next || devDependencies?.next) {
    autodetectDescription = 'is using Next.js'
    toImport = '@platformatic/next'
  } else if (dependencies?.vite || devDependencies?.vite) {
    autodetectDescription = 'is using Vite'
    toImport = '@platformatic/vite'
  }

  const imported = await importStackablePackage(opts, toImport, autodetectDescription)
  return imported.buildStackable(opts)
}

export default {
  configType: 'nodejs',
  configManagerConfig: {},
  buildStackable,
  schema,
  version: packageJson.version,
}

export * from './lib/base.js'
export * as errors from './lib/errors.js'
export { schema, schemaComponents } from './lib/schema.js'
export * from './lib/utils.js'
export * from './lib/worker/child-manager.js'
export * from './lib/worker/server-listener.js'
