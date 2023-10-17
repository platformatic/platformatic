import fp from 'fastify-plugin'
import { platformaticService, buildServer as buildServiceServer, Stackable, PlatformaticServiceConfig } from '../../../../index.js'
import { schema } from './schema.js'
import dynamite from './dynamite.js'
import { lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { FastifyInstance } from 'fastify'
import type { ConfigManager } from '@platformatic/config'
import type { AcmeBase as AcmeBaseConfig } from './config.js'

export interface AcmeBaseMixin {
  platformatic: {
    configManager: ConfigManager<AcmeBaseConfig>,
    config: AcmeBaseConfig
  }
}

async function isDirectory (path: string) {
  try {
    return (await lstat(path)).isDirectory()
  } catch {
    return false
  }
}

function buildStackable () : Stackable<AcmeBaseConfig> {
  async function acmeBase (_app: FastifyInstance, opts: object) {
    const app = _app as FastifyInstance & AcmeBaseMixin
    if (app.platformatic.config.dynamite) {
      app.register(dynamite)
    }

    await platformaticService(app, opts)
  }

  // break Fastify encapsulation
  fp(acmeBase)

  acmeBase.configType = 'acmeBase'

  // This is the schema for this reusable application configuration file,
  // customize at will but retain the base properties of the schema from
  // @platformatic/service
  acmeBase.schema = schema

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
    async transformConfig (this: ConfigManager<AcmeBaseConfig & PlatformaticServiceConfig>) {
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

      if (!this.current?.service?.openapi) {
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

  return acmeBase
}

export const acmeBase = buildStackable()

export default acmeBase

export async function buildServer (opts: object) {
  return buildServiceServer(opts, acmeBase)
}
