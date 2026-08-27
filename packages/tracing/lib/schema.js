import { schemaComponents } from '@platformatic/foundation'

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
