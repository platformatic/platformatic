import { schemaComponents } from '@platformatic/basic'
import { schemas as utilsSchema } from '@platformatic/utils'
import { readFileSync } from 'node:fs'

export const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/vite/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Vite Stackable',
  type: 'object',
  properties: {
    $schema: {
      type: 'string',
    },
    server: utilsSchema.server,
    watch: schemaComponents.watch,
    application: schemaComponents.application,
    vite: {
      type: 'object',
      properties: {
        configFile: {
          oneOf: [{ type: 'string' }, { type: 'boolean' }],
        },
        ssr: {
          oneOf: [
            {
              type: 'object',
              properties: { entrypoint: { type: 'string' } },
              required: ['entrypoint'],
              additionalProperties: false,
            },
            { type: 'boolean' },
          ],
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