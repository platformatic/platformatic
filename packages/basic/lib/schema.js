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
  },
  additionalProperties: false,
}
