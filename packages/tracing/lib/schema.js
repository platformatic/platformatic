import { schemaComponents } from '@platformatic/foundation/schema'

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
