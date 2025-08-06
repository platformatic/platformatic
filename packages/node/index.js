import { transform as basicTransform, resolve, validationOptions } from '@platformatic/basic'
import { kMetadata, loadConfiguration as utilsLoadConfiguration } from '@platformatic/foundation'
import { schema } from './lib/schema.js'
import { NodeStackable } from './lib/stackable.js'

export async function transform (config, _schema, options) {
  config = await basicTransform(config, schema, options)
  config.telemetry = { ...options.telemetryConfig, ...config.telemetry }

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
  return new NodeStackable(config[kMetadata].root, config, context)
}

export { Generator } from './lib/generator.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
export * from './lib/stackable.js'
