import { resolve, validationOptions } from '@platformatic/basic'
import { kMetadata, loadConfiguration as utilsLoadConfiguration } from '@platformatic/foundation'
import { transform } from '@platformatic/service'
import { schema } from './lib/schema.js'
import { ComposerStackable } from './lib/stackable.js'
import { upgrade } from './lib/upgrade.js'

export async function loadConfiguration (configOrRoot, sourceOrConfig, context) {
  const { root, source } = await resolve(configOrRoot, sourceOrConfig, 'composer')

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
  return new ComposerStackable(config[kMetadata].root, config, context)
}

export const skipTelemetryHooks = true

export { platformaticComposer } from './lib/application.js'
export * from './lib/commands/index.js'
export * from './lib/errors.js'
export * as errors from './lib/errors.js'
export { Generator } from './lib/generator.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
export { ComposerStackable } from './lib/stackable.js'
