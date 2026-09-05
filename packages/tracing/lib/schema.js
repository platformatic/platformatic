import { schemaComponents } from '@platformatic/foundation/lib/schema.js'

const schema = {
  ...schemaComponents.tracing,
  properties: {
    ...schemaComponents.tracing.properties,
    module: {
      type: 'string'
    }
  }
}

export default schema
