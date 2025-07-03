import { schemaOptions, transformConfig } from './lib/config.js'
import { buildStackable } from './lib/creation.js'
import { packageJson, schema } from './lib/schema.js'

export default {
  configType: 'nodejs',
  configManagerConfig: {
    schemaOptions,
    transformConfig
  },
  buildStackable,
  schema,
  version: packageJson.version
}

export * from './lib/base.js'
export * from './lib/config.js'
export * from './lib/creation.js'
export * as errors from './lib/errors.js'
export * from './lib/modules.js'
export { schema, schemaComponents } from './lib/schema.js'
export * from './lib/utils.js'
export * from './lib/worker/child-manager.js'
export * from './lib/worker/listeners.js'
