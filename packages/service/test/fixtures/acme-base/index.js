import { lstat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  create as createService,
  platformaticService,
  transformConfig as serviceTransformConfig
} from '../../../index.js'
import dynamite from './lib/dynamite.js'
import { schema } from './lib/schema.js'

export { configManagerConfig } from '../../../index.js'
export { schema } from './lib/schema.js'

async function isDirectory (path) {
  try {
    return (await lstat(path)).isDirectory()
  } catch {
    return false
  }
}

export default async function acmeBase (app, stackable) {
  if (app.platformatic.config.dynamite) {
    app.register(dynamite)
  }

  await platformaticService(app, stackable)
}

acmeBase[Symbol.for('skip-override')] = true

export const configType = 'acmeBase'

export async function transformConfig () {
  // Call the transformConfig method from the base stackable
  serviceTransformConfig.call(this)

  // In this method you can alter the configuration before the application
  // is started. It's useful to apply some defaults that cannot be derived
  // inside the schema, such as resolving paths.

  const paths = []

  const pluginsDir = join(this.dirname, 'plugins')

  if (await isDirectory(pluginsDir)) {
    paths.push({
      path: pluginsDir,
      encapsulate: false
    })
  }

  const routesDir = join(this.dirname, 'routes')

  if (await isDirectory(routesDir)) {
    paths.push({
      path: routesDir
    })
  }

  this.current.plugins = {
    paths
  }

  if (!this.current.server?.openapi) {
    if (typeof this.current.service !== 'object') {
      this.current.service = {}
    }
    this.current.service.openapi = {
      info: {
        title: 'Acme Microservice',
        description: 'A microservice for Acme Inc.',
        version: '1.0.0'
      }
    }
  }
}

export async function create (opts) {
  return createService(
    process.cwd(),
    opts,
    {},
    { schema, applicationFactory: acmeBase, configManagerConfig: { transformConfig } }
  )
}
