import { kMetadata } from '@platformatic/foundation'
import { lstat } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  create as createService,
  platformaticService,
  ServerInstance,
  ServiceCapability,
  transform as serviceTransform,
  type PlatformaticServiceConfig as ServiceConfig
} from '../../../../../index.js'

import { type AcmeBaseConfig } from './config.js'
import dynamite from './dynamite.js'
import { schema } from './schema.js'

export { schema } from './schema.js'

async function isDirectory (path: string) {
  try {
    return (await lstat(path)).isDirectory()
  } catch {
    return false
  }
}

export default async function acmeBase (
  app: ServerInstance<ServiceConfig & AcmeBaseConfig>,
  capability: ServiceCapability
) {
  if (app.platformatic.config.dynamite) {
    app.register(dynamite)
  }

  await platformaticService(app, capability)
}

Object.assign(acmeBase, { [Symbol.for('skip-override')]: true })

export async function transform (config: ServiceConfig & AcmeBaseConfig): ServiceConfig & AcmeBaseConfig {
  // Call the transformConfig method from the base capability
  config = await serviceTransform(config)

  // In this method you can alter the configuration before the application
  // is started. It's useful to apply some defaults that cannot be derived
  // inside the schema, such as resolving paths.

  const paths = []

  const pluginsDir = resolve(config[kMetadata].root, 'plugins')

  if (await isDirectory(pluginsDir)) {
    paths.push({
      path: pluginsDir,
      encapsulate: false
    })
  }

  const routesDir = resolve(config[kMetadata].root, 'routes')

  if (await isDirectory(routesDir)) {
    paths.push({
      path: routesDir
    })
  }

  config.plugins = { paths }

  if (!config.service?.openapi) {
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

export async function create (opts: object) {
  return createService(process.cwd(), opts, { schema, applicationFactory: acmeBase, transform })
}
