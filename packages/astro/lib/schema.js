import { schemaComponents as basicSchemaComponents } from '@platformatic/basic'
import { schemaComponents as utilsSchemaComponents } from '@platformatic/utils'
import { readFileSync } from 'node:fs'

export const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))

export const astro = {
  type: 'object',
  properties: {
    configFile: {
      oneOf: [{ type: 'string' }, { type: 'boolean' }]
    }
  },
  default: {},
  additionalProperties: false
}

export const schemaComponents = { astro }

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/astro/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Astro Stackable',
  type: 'object',
  properties: {
    $schema: {
      type: 'string'
    },
    server: utilsSchemaComponents.server,
    watch: basicSchemaComponents.watch,
    application: basicSchemaComponents.application,
    astro
  },
  additionalProperties: false
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}
