import { resolve, validationOptions } from '@platformatic/basic'
import { kMetadata, loadConfiguration as utilsLoadConfiguration } from '@platformatic/foundation'
import { transform } from '@platformatic/service'
import { GatewayCapability } from './lib/capability.js'
import { schema } from './lib/schema.js'
import { upgrade } from './lib/upgrade.js'

export async function loadConfiguration (configOrRoot, sourceOrConfig, context) {
  const { root, source } = await resolve(configOrRoot, sourceOrConfig, 'gateway')

  return utilsLoadConfiguration(source, context?.schema ?? schema, {
    validationOptions,
    transform,
    upgrade,
    replaceEnv: true,
    root,
    ...context
  })
}

export async function create (configOrRoot, sourceOrConfig, context) {
  const config = await loadConfiguration(configOrRoot, sourceOrConfig, context)
  return new GatewayCapability(config[kMetadata].root, config, context)
}

export const skipTelemetryHooks = true

export { platformaticGateway } from './lib/application.js'
export { GatewayCapability } from './lib/capability.js'
export * from './lib/commands/index.js'
export * from './lib/errors.js'
export * as errors from './lib/errors.js'
export { Generator } from './lib/generator.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
