import { transform as basicTransform, resolve, validationOptions } from '@platformatic/basic'
import { loadConfiguration as utilsLoadConfiguration } from '@platformatic/foundation'
import { schema } from './schema.js'

export async function transform (config, schema, options) {
  config = await basicTransform(config, schema, options)
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
