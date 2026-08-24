import { schemaComponents } from '@platformatic/foundation/lib/schema.js'

const schema = {
  ...schemaComponents.telemetry,
  properties: {
    ...schemaComponents.telemetry.properties,
    module: {
      type: 'string'
    }
  }
}

export default schema
