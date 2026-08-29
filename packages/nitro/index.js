import { loadCapabilityConfiguration, transform as basicTransform, validationOptions } from '@platformatic/basic'
import { kMetadata } from '@platformatic/foundation'
import { hasViteConfigFile, NitroCapability, NitroViteCapability } from './lib/capability.js'
import { schema } from './lib/schema.js'

/* c8 ignore next 6 */
export async function transform (config, schema, options) {
  config = await basicTransform(config, schema, options)

  if (config.application.include === undefined) {
    config.application.include = [config.nitro.outputDirectory ?? config.application.outputDirectory]
  }

  config.watch = { enabled: false }
  return config
}

export async function loadConfiguration (configOrRoot, sourceOrConfig, context) {
  return loadCapabilityConfiguration(configOrRoot, sourceOrConfig, context, {
    schema,
    scope: import.meta.filename,
    suffixes: 'application',
    validationOptions,
    transform
  })
}

export async function create (configOrRoot, sourceOrConfig, context) {
  const config = await loadConfiguration(configOrRoot, sourceOrConfig, context)
  const root = config[kMetadata].root
  const Capability = hasViteConfigFile(root, config) ? NitroViteCapability : NitroCapability

  return new Capability(root, config, context)
}

export * from './lib/capability.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'

export * from './lib/factory.js'
