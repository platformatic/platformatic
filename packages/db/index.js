import { resolve, validationOptions } from '@platformatic/basic'
import { kMetadata, loadConfiguration as utilsLoadConfiguration } from '@platformatic/foundation'
import { DatabaseCapability } from './lib/capability.js'
import { schema } from './lib/schema.js'
import { upgrade } from './lib/upgrade.js'
import { transform as _transform } from './lib/config-transform.js'

export const transform = _transform

export async function loadConfiguration (configOrRoot, sourceOrConfig, context) {
  const { root, source } = await resolve(configOrRoot, sourceOrConfig, 'db')

  return utilsLoadConfiguration(source, context?.schema ?? schema, {
    validationOptions,
    transform,
    upgrade,
    replaceEnv: true,
    replaceEnvIgnore: ['$.db.openapi.ignoreRoutes'],
    root,
    ...context
  })
}

export async function create (configOrRoot, sourceOrConfig, context) {
  const config = await loadConfiguration(configOrRoot, sourceOrConfig, context)
  return new DatabaseCapability(config[kMetadata].root, config, context)
}

export const skipTelemetryHooks = true

export { platformaticDatabase } from './lib/application.js'
export { DatabaseCapability } from './lib/capability.js'
export * from './lib/commands/index.js'
export * from './lib/errors.js'
export * as errors from './lib/errors.js'
export { Generator } from './lib/generator.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
