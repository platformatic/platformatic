import { resolve, validationOptions } from '@platformatic/basic'
import { transform } from '@platformatic/service'
import { loadConfiguration } from '@platformatic/utils'
import { schema } from './lib/schema.js'
import { ComposerStackable } from './lib/stackable.js'
import { upgrade } from './lib/upgrade.js'

export async function create (configFileOrRoot, sourceOrConfig, context) {
  const { root, source } = await resolve(configFileOrRoot, sourceOrConfig, 'service')

  const config = await loadConfiguration(source, context?.schema ?? schema, {
    validationOptions: context?.validationOptions ?? validationOptions,
    transform: context?.transform ?? transform,
    upgrade: context?.upgrade ?? upgrade,
    replaceEnv: true,
    onMissingEnv: context?.onMissingEnv,
    root
  })

  return new ComposerStackable(root, config, context)
}

export const skipTelemetryHooks = true

export { platformaticComposer } from './lib/application.js'
export * from './lib/commands/index.js'
export * from './lib/errors.js'
export { Generator } from './lib/generator.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
export { ComposerStackable } from './lib/stackable.js'
