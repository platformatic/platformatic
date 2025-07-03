import esMain from 'es-main'
import service from '../../../../index.js'

export const schema = structuredClone(service.schema)

schema.$id = 'https://raw.githubusercontent.com/platformatic/acme-base/main/schemas/1.json'
schema.title = 'Acme Base'

// Needed to allow module loading
schema.properties.module = {
  type: 'string'
}

schema.properties.dynamite = {
  anyOf: [
    {
      type: 'boolean'
    },
    {
      type: 'string'
    }
  ],
  description: 'Enable /dynamite route'
}

delete schema.properties.plugins

if (esMain(import.meta)) {
  console.log(JSON.stringify(schema, null, 2))
}
