import { schemas } from '@platformatic/utils'
import { readFileSync } from 'node:fs'

export const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))

const application = {
  type: 'object',
  properties: {
    basePath: {
      type: 'string',
    },
  },
  additionalProperties: false,
}

const watch = {
  anyOf: [
    schemas.watch,
    {
      type: 'boolean',
    },
    {
      type: 'string',
    },
  ],
}

export const schemaComponents = { application, watch }

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/basic/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Stackable',
  type: 'object',
  properties: {
    $schema: {
      type: 'string',
    },
    server: schemas.server,
    watch,
  },
  additionalProperties: false,
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}
