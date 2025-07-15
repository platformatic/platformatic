import { transform as basicTransform, resolve, validationOptions } from '@platformatic/basic'
import { loadConfiguration } from '@platformatic/utils'
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

export async function create (configFileOrRoot, sourceOrConfig, context) {
  const { root, source } = await resolve(configFileOrRoot, sourceOrConfig, 'application')

  const config = await loadConfiguration(source, context?.schema ?? schema, {
    validationOptions: context?.validationOptions ?? validationOptions,
    transform: context?.transform ?? transform,
    upgrade: context?.upgrade,
    replaceEnv: true,
    onMissingEnv: context?.onMissingEnv,
    root
  })

  return new NextStackable(root, config, context)
}

export * as cachingValkey from './lib/caching/valkey.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
export * from './lib/stackable.js'
