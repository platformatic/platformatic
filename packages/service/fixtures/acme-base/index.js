import { platformaticService, buildServer as buildServiceServer } from '../../index.js'
import { schema } from './lib/schema.js'
import dynamite from './lib/dynamite.js'
import { lstat } from 'node:fs/promises'
import { join } from 'node:path'

export default async function acmeBase (app, opts) {
  if (app.platformatic.config.dynamite) {
    app.register(dynamite)
  }

  await platformaticService(app, opts)
}

export async function buildServer (opts) {
  return buildServiceServer(opts, acmeBase)
}

// break Fastify encapsulation
acmeBase[Symbol.for('skip-override')] = true
acmeBase.configType = 'acmeBase'

// This is the schema for this reusable application configuration file,
// customize at will but retain the base properties of the schema from
// @platformatic/service
acmeBase.schema = schema

async function isDirectory (path) {
  try {
    return (await lstat(path)).isDirectory()
  } catch {
    return false
  }
}

// The configuration of the ConfigManager
acmeBase.configManagerConfig = {
  schema,
  envWhitelist: ['PORT', 'HOSTNAME', 'WATCH'],
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  },
  async transformConfig () {
    // Call the transformConfig method from the base stackable
    platformaticService.configManagerConfig.transformConfig.call(this)

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
}
