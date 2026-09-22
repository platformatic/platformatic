import { loadCapabilityConfiguration, validationOptions } from '@platformatic/basic'
import { kMetadata } from '@platformatic/foundation'
import { DatabaseCapability } from './lib/capability.js'
import { transform } from './lib/config.js'
import { schema } from './lib/schema.js'
import { upgrade } from './lib/upgrade.js'

export async function loadConfiguration (configOrRoot, sourceOrConfig, context) {
  return loadCapabilityConfiguration(configOrRoot, sourceOrConfig, context, {
    schema,
    scope: import.meta.filename,
    suffixes: 'db',
    validationOptions,
    transform,
    upgrade,
    replaceEnvIgnore: ['$.db.openapi.ignoreRoutes']
  })
}

export async function create (configOrRoot, sourceOrConfig, context) {
  const config = await loadConfiguration(configOrRoot, sourceOrConfig, context)
  return new DatabaseCapability(config[kMetadata].root, config, context)
}

export { platformaticDatabase } from './lib/application.js'
export { DatabaseCapability } from './lib/capability.js'
export * from './lib/commands/index.js'
export { transform } from './lib/config.js'
export * from './lib/errors.js'
export * as errors from './lib/errors.js'
export { Generator } from './lib/generator.js'
export { packageJson, schema, schemaComponents, skipTracingHooks, version } from './lib/schema.js'

export * from './lib/factory.js'
