import { BaseStackable } from '@platformatic/basic'
import type { ConfigManager } from '@platformatic/config'
import { FastifyInstance } from 'fastify'
import { lstat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { type PlatformaticService as PlatformaticServiceConfig } from '../../../../../config.js'
import {
  create as createService,
  platformaticService,
  transformConfig as serviceTransformConfig
} from '../../../../../index.js'

import { type AcmeBaseConfig } from './config.js'
import dynamite from './dynamite.js'
import { schema } from './schema.js'

export { configManagerConfig } from '../../../../../index.js'
export { schema } from './schema.js'

export interface AcmeBaseMixin {
  platformatic: {
    configManager: ConfigManager<AcmeBaseConfig>
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

export default async function acmeBase (app: FastifyInstance & AcmeBaseMixin, stackable: BaseStackable) {
  if (app.platformatic.config.dynamite) {
    app.register(dynamite)
  }

  await platformaticService(app, stackable)
}

Object.assign(acmeBase, { [Symbol.for('skip-override')]: true })

export const configType = 'acmeBase'

export async function transformConfig (this: ConfigManager<PlatformaticServiceConfig & AcmeBaseConfig>) {
  // Call the transformConfig method from the base stackable
  serviceTransformConfig.call(this)

  // In this method you can alter the configuration before the application
  // is started. It's useful to apply some defaults that cannot be derived
  // inside the schema, such as resolving paths.

  const paths = []

  const pluginsDir = resolve(this.dirname, 'plugins')

  if (await isDirectory(pluginsDir)) {
    paths.push({
      path: pluginsDir,
      encapsulate: false
    })
  }

  const routesDir = resolve(this.dirname, 'routes')

  if (await isDirectory(routesDir)) {
    paths.push({
      path: routesDir
    })
  }

  this.current.plugins = {
    paths
  }

  if (!this.current.service?.openapi) {
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

export async function create (opts: object) {
  return createService(
    process.cwd(),
    opts,
    {},
    { schema, applicationFactory: acmeBase, configManagerConfig: { transformConfig } }
  )
}
