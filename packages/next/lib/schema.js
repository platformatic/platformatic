import { schemaComponents } from '@platformatic/basic'
import { schemaComponents as utilsSchemaComponents } from '@platformatic/utils'
import { readFileSync } from 'node:fs'

export const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))

export const cache = {
  type: 'object',
  properties: {
    adapter: {
      type: 'string',
      enum: ['redis', 'valkey']
    },
    url: {
      type: 'string'
    },
    prefix: {
      type: 'string'
    },
    maxTTL: {
      default: 86400 * 7, // One week
      anyOf: [
        {
          type: 'number',
          minimum: 0
        },
        {
          type: 'string'
        }
      ]
    }
  },
  required: ['adapter', 'url'],
  additionalProperties: false
}

const next = {
  type: 'object',
  properties: {
    trailingSlash: {
      type: 'boolean',
      default: false
    }
  },
  default: {},
  additionalProperties: false
}

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/next/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Next.js Config',
  type: 'object',
  properties: {
    $schema: {
      type: 'string'
    },
    logger: utilsSchemaComponents.logger,
    server: utilsSchemaComponents.server,
    watch: schemaComponents.watch,
    application: schemaComponents.application,
    runtime: utilsSchemaComponents.wrappedRuntime,
    next,
    cache
  },
  additionalProperties: false
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}
