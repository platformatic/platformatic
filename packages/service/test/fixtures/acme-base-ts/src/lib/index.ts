import { BaseOptions, BaseStackable, schemaOptions } from '@platformatic/basic'
import { ConfigManager, findConfigurationFile } from '@platformatic/config'
import { FastifyInstance } from 'fastify'
import { lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { PlatformaticService as PlatformaticServiceConfig } from '../../../../../config.js'
import {
  platformaticService,
  ServiceContext,
  ServiceStackable,
  transformConfig as serviceTransformConfig
} from '../../../../../index.js'
import { AcmeBase } from './config.js'
import dynamite from './dynamite.js'
import { schema } from './schema.js'

export interface AcmeBaseMixin {
  platformatic: {
    configManager: ConfigManager<AcmeBase>
    config: AcmeBase
  }
}

export default async function acmeBase (
  app: FastifyInstance,
  stackable: BaseStackable<AcmeBase & PlatformaticServiceConfig>
) {
  if ((app as FastifyInstance & AcmeBaseMixin).platformatic.config.dynamite) {
    app.register(dynamite)
  }

  await platformaticService(app, stackable)
}

// @ts-ignore
acmeBase[Symbol.for('skip-override')] = true

async function isDirectory (path: string) {
  try {
    return (await lstat(path)).isDirectory()
  } catch {
    return false
  }
}

async function transformConfig (this: ConfigManager<AcmeBase & PlatformaticServiceConfig>) {
  // Call the transformConfig method from the base stackable
  await serviceTransformConfig.call(this)

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

export async function create (
  root: string,
  source?: string | object,
  opts?: BaseOptions<ServiceContext>,
  context?: Partial<ServiceContext>
) {
  source ??= await findConfigurationFile(root, 'service')

  context ??= {}
  context.directory = root

  opts ??= { context }
  opts.context = context
  opts.context.applicationFactory = acmeBase

  const configManager = new ConfigManager({
    schema,
    source: source as string,
    schemaOptions,
    transformConfig,
    dirname: root,
    context
  })
  await configManager.parseAndValidate()

  return new ServiceStackable(opts, root, configManager)
}
