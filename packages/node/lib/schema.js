import { schemaComponents as basicSchemaComponents } from '@platformatic/basic'
import { schemaComponents as utilsSchemaComponents } from '@platformatic/utils'
import { readFileSync } from 'node:fs'

export const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))

const node = {
  type: 'object',
  properties: {
    entrypoint: {
      type: 'string'
    }
  },
  default: {},
  additionalProperties: false
}

export const schemaComponents = { node }

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/vite/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Node.js Stackable',
  type: 'object',
  properties: {
    $schema: {
      type: 'string'
    },
    server: utilsSchemaComponents.server,
    watch: basicSchemaComponents.watch,
    application: basicSchemaComponents.application,
    node
  },
  additionalProperties: false
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}
