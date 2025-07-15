import { resolve, transform, validationOptions } from '@platformatic/basic'
import { loadConfiguration } from '@platformatic/utils'
import { schema } from './lib/schema.js'
import { NodeStackable } from './lib/stackable.js'

export async function create (configFileOrRoot, sourceOrConfig, context) {
  const { root, source } = await resolve(configFileOrRoot, sourceOrConfig, 'application')

  const config = await loadConfiguration(source, context?.schema ?? schema, {
    validationOptions: context?.validationOptions ?? validationOptions,
    transform: context?.transform ?? transform,
    upgrade: context?.upgrade,
    replaceEnv: true,
    onMissingEnv: context?.onMissingEnv,
    root
  })

  return new NodeStackable(root, config, context)
}

export { Generator } from './lib/generator.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
export * from './lib/stackable.js'
