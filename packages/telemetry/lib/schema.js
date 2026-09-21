import { schemaComponents } from '@platformatic/foundation'

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
