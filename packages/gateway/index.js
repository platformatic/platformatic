import { resolve, validationOptions } from '@platformatic/basic'
import { isEnabled, kMetadata, loadConfiguration as utilsLoadConfiguration } from '@platformatic/foundation'
import { transform as serviceTransform } from '@platformatic/service'
import { GatewayCapability } from './lib/capability.js'
import { schema } from './lib/schema.js'
import { upgrade } from './lib/upgrade.js'

// A disabled entry is left out of the gateway entirely: it is no dependency of the gateway, and
// it is neither proxied nor composed. So an application the runtime disables can be named here,
// with the same `enabled`, without the runtime refusing to start for want of it.
export async function transform (config, schema, options) {
  config = await serviceTransform(config, schema, options)

  if (Array.isArray(config.gateway?.applications)) {
    const production = options?.isProduction ?? options?.production
    const environment = production ? 'production' : 'development'
    config.gateway.applications = config.gateway.applications.filter(application =>
      isEnabled(application.enabled, environment)
    )
  }

  return config
}

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
