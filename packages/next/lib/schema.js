import { schemaComponents as basicSchemaComponents } from '@platformatic/basic'
import { parsePackageJSON, schemaComponents as utilsSchemaComponents } from '@platformatic/foundation'

export const packageJson = parsePackageJSON(import.meta.dirname)
export const version = packageJson.version

export const cache = {
  type: 'object',
  properties: {
    enabled: {
      anyOf: [
        {
          type: 'boolean'
        },
        {
          type: 'string'
        }
      ]
    },
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
    cacheComponents: {
      type: 'boolean'
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
    },
    ignoreNextConfig: {
      anyOf: [
        {
          type: 'boolean'
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
    standalone: {
      type: 'boolean'
    },
    trailingSlash: {
      type: 'boolean',
      default: false
    },
    useExperimentalAdapter: {
      type: 'boolean',
      default: false
    },
    https: {
      type: 'object',
      properties: {
        enabled: {
          anyOf: [
            {
              type: 'boolean'
            },
            {
              type: 'string'
            }
          ]
        },
        key: {
          type: 'string'
        },
        cert: {
          type: 'string'
        },
        ca: {
          type: 'string'
        }
      },
      additionalProperties: false
    }
  },
  default: {},
  additionalProperties: false
}

export const schemaComponents = { next, cache }

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
    watch: basicSchemaComponents.watch,
    application: basicSchemaComponents.buildableApplication,
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
