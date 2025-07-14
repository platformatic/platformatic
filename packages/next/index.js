import { transform as basicTransform, resolve, validationOptions } from '@platformatic/basic'
import { kMetadata, loadConfiguration as utilsLoadConfiguration } from '@platformatic/utils'
import { schema } from './lib/schema.js'
import { NextStackable } from './lib/stackable.js'

/* c8 ignore next 9 */
export async function transform (config) {
  config = await basicTransform(config)
  config.watch = { enabled: false }

  if (config.cache?.adapter === 'redis') {
    config.cache.adapter = 'valkey'
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
  return new NextStackable(config[kMetadata].root, config, context)
}

export * as cachingValkey from './lib/caching/valkey.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
export * from './lib/stackable.js'
