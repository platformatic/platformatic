import { schemas } from '@platformatic/utils'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url))))

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
    watch: {
      anyOf: [
        schemas.watch,
        {
          type: 'boolean',
        },
        {
          type: 'string',
        },
      ],
    },
    application: {
      type: 'object',
      properties: {
        base: {
          type: 'string',
        },
      },
      additionalProperties: false,
    },
    vite: {
      type: 'object',
      properties: {
        configFile: {
          oneOf: [{ type: 'string' }, { type: 'boolean' }],
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}
