import { transform as basicTransform, resolve, validationOptions } from '@platformatic/basic'
import { kMetadata, loadConfiguration as utilsLoadConfiguration } from '@platformatic/utils'
import { schema } from './lib/schema.js'
import { ViteSSRStackable, ViteStackable } from './lib/stackable.js'

/* c8 ignore next 5 */
export async function transform (config) {
  config = await basicTransform(config)

  config.watch = { enabled: false }

  if (config.vite.ssr === true) {
    config.vite.ssr = {
      enabled: true,
      entrypoint: 'server.js',
      clientDirectory: 'client',
      serverDirectory: 'server'
    }
  }

  return config
}

export async function loadConfiguration (configOrRoot, sourceOrConfig, context) {
  const { root, source } = await resolve(configOrRoot, sourceOrConfig, 'application')

  return utilsLoadConfiguration(source, context?.schema ?? schema, {
    validationOptions,
    transform,
    replaceEnv: true,
    root,
    ...context
  })
}

export async function create (configOrRoot, sourceOrConfig, context) {
  const config = await loadConfiguration(configOrRoot, sourceOrConfig, context)

  // When in SSR mode, we use ViteSSRStackable, which is a subclass of @platformatic/node
  const Stackable = config.vite?.ssr?.enabled ? ViteSSRStackable : ViteStackable
  return new Stackable(config[kMetadata].root, config, context)
}

export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
export * from './lib/stackable.js'
