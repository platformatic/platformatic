import { schema as serviceSchema } from '../../../../../index.js'

const baseSchema = serviceSchema

export const schema = structuredClone(baseSchema)

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

// @ts-expect-error Types not updated yet
if (import.meta.main) {
  console.log(JSON.stringify(schema, null, 2))
}
