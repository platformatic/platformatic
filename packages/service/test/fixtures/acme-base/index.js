import { kMetadata } from '@platformatic/foundation'
import { lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { create as createService, platformaticService, transform as serviceTransform } from '../../../index.js'
import dynamite from './lib/dynamite.js'
import { schema } from './lib/schema.js'

export { schema } from './lib/schema.js'

async function isDirectory (path) {
  try {
    return (await lstat(path)).isDirectory()
  } catch {
    return false
  }
}

export default async function acmeBase (app, capability) {
  if (app.platformatic.config.dynamite) {
    app.register(dynamite)
  }

  await platformaticService(app, capability)
}

acmeBase[Symbol.for('skip-override')] = true

export async function transform (config) {
  // Call the transformConfig method from the base capability
  config = await serviceTransform(config)

  // In this method you can alter the configuration before the application
  // is started. It's useful to apply some defaults that cannot be derived
  // inside the schema, such as resolving paths.

  const paths = []

  const pluginsDir = join(config[kMetadata].root, 'plugins')

  if (await isDirectory(pluginsDir)) {
    paths.push({
      path: pluginsDir,
      encapsulate: false
    })
  }

  const routesDir = join(config[kMetadata].root, 'routes')

  if (await isDirectory(routesDir)) {
    paths.push({
      path: routesDir
    })
  }

  config.plugins = { paths }

  if (!config.server?.openapi) {
    if (typeof config.service !== 'object') {
      config.service = {}
    }

    config.service.openapi = {
      info: {
        title: 'Acme Microservice',
        description: 'A microservice for Acme Inc.',
        version: '1.0.0'
      }
    }
  }

  return config
}

export async function create (opts) {
  return createService(process.cwd(), opts, {
    schema,
    applicationFactory: acmeBase,
    transform
  })
}
