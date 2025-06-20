import { schemaOptions } from '@platformatic/basic'
import { ConfigManager, findConfigurationFile } from '@platformatic/config'
import { lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { platformaticService, ServiceStackable, transformConfig as serviceTransformConfig } from '../../../index.js'
import dynamite from './lib/dynamite.js'
import { schema } from './lib/schema.js'

export default async function acmeBase (app, stackable) {
  if (app.platformatic.config.dynamite) {
    app.register(dynamite)
  }

  await platformaticService(app, stackable)
}

acmeBase[Symbol.for('skip-override')] = true

async function isDirectory (path) {
  try {
    return (await lstat(path)).isDirectory()
  } catch {
    return false
  }
}

async function transformConfig () {
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

export async function createStackable (root, source, opts, context) {
  source ??= await findConfigurationFile(root, 'service')

  context ??= {}
  context.directory = root

  opts ??= {}
  opts.context = context
  opts.context.applicationFactory = acmeBase

  const configManager = new ConfigManager({
    schema,
    source,
    schemaOptions,
    transformConfig,
    dirname: root,
    context
  })
  await configManager.parseAndValidate()

  return new ServiceStackable(opts, root, configManager)
}
