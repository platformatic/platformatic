import { loadCapabilityConfiguration, transform as basicTransform, validationOptions } from '@platformatic/basic'
import { kMetadata } from '@platformatic/foundation'
import { NodeCapability } from './lib/capability.js'
import { schema } from './lib/schema.js'

export async function transform (config, _schema, options) {
  config = await basicTransform(config, schema, options)
  config.telemetry = { ...options.telemetryConfig, ...config.telemetry }

  return config
}

export async function loadConfiguration (configOrRoot, sourceOrConfig, context) {
  return loadCapabilityConfiguration(configOrRoot, sourceOrConfig, context, {
    schema,
    scope: import.meta.filename,
    suffixes: 'application',
    validationOptions,
    transform,
    replaceEnv: true
  })
}

export async function create (configOrRoot, sourceOrConfig, context) {
  const config = await loadConfiguration(configOrRoot, sourceOrConfig, context)
  return new NodeCapability(config[kMetadata].root, config, context)
}

export * from './lib/capability.js'
export { Generator } from './lib/generator.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'

export * from './lib/factory.js'
