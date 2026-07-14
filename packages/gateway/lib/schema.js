#! /usr/bin/env node

import { schemaComponents as basicSchemaComponents } from '@platformatic/basic'
import {
  fastifyServer as server,
  schemaComponents as utilsSchemaComponents,
  watch,
  wrappedRuntime
} from '@platformatic/foundation'
import { schemaComponents as applicationSchemaComponents } from '@platformatic/service'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { $defs, graphqlBase, openApiBase, plugins } = applicationSchemaComponents

export const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'))
export const version = packageJson.version

export const openApiApplication = {
  type: 'object',
  properties: {
    url: { type: 'string' },
    file: { type: 'string', resolvePath: true },
    prefix: { type: 'string' },
    config: { type: 'string', resolvePath: true }
  },
  anyOf: [{ required: ['url'] }, { required: ['file'] }],
  additionalProperties: false
}

export const entityResolver = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    argsAdapter: {
      anyOf: [{ typeof: 'function' }, { type: 'string' }]
    },
    partialResults: {
      anyOf: [{ typeof: 'function' }, { type: 'string' }]
    }
  },
  required: ['name'],
  additionalProperties: false
}

export const entities = {
  type: 'object',
  patternProperties: {
    '^.*$': {
      type: 'object',
      properties: {
        pkey: { type: 'string' },
        resolver: entityResolver,
        fkeys: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              field: { type: 'string' },
              as: { type: 'string' },
              pkey: { type: 'string' },
              subgraph: { type: 'string' },
              resolver: entityResolver
            },
            required: ['type']
          }
        },
        many: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              fkey: { type: 'string' },
              as: { type: 'string' },
              pkey: { type: 'string' },
              subgraph: { type: 'string' },
              resolver: entityResolver
            },
            required: ['type', 'fkey', 'resolver']
          }
        }
      }
    }
  }
}

export const graphqlApplication = {
  anyOf: [
    { type: 'boolean' },
    {
      type: 'object',
      properties: {
        host: { type: 'string' },
        name: { type: 'string' },
        graphqlEndpoint: { type: 'string', default: '/graphql' },
        composeEndpoint: { type: 'string', default: '/.well-known/graphql-composition' },
        entities
      },
      additionalProperties: false
    }
  ]
}

export const graphqlComposerOptions = {
  type: 'object',
  properties: {
    ...graphqlBase.properties,
    // TODO support subscriptions, subscriptions: { type: 'boolean', default: false },
    onSubgraphError: { typeof: 'function' },
    defaultArgsAdapter: {
      oneOf: [{ typeof: 'function' }, { type: 'string' }]
    },
    entities,
    addEntitiesResolvers: { type: 'boolean', default: false }
  },
  additionalProperties: false
}

export const deduplicationRoute = {
  type: 'object',
  properties: {
    method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'] },
    methods: {
      type: 'array',
      items: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'] }
    },
    path: { type: 'string' }
  },
  required: ['path'],
  anyOf: [{ required: ['method'] }, { required: ['methods'] }],
  additionalProperties: false
}

export const deduplicationStorage = {
  anyOf: [
    {
      type: 'object',
      properties: {
        adapter: { type: 'string', const: 'memory', default: 'memory' }
      },
      additionalProperties: false
    },
    {
      type: 'object',
      properties: {
        adapter: { type: 'string', const: 'valkey' },
        url: { type: 'string' },
        prefix: { type: 'string' }
      },
      required: ['adapter', 'url'],
      additionalProperties: false
    }
  ]
}

export const deduplication = {
  type: 'object',
  properties: {
    enabled: {
      anyOf: [{ type: 'boolean' }, { type: 'string' }]
    },
    storage: deduplicationStorage,
    methods: {
      type: 'array',
      items: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'] },
      default: ['GET', 'HEAD']
    },
    headers: {
      type: 'array',
      items: { type: 'string' },
      default: ['authorization', 'accept', 'accept-encoding', 'accept-language']
    },
    skipHeaders: {
      type: 'array',
      items: { type: 'string' },
      default: ['cookie']
    },
    routes: {
      type: 'array',
      items: deduplicationRoute
    },
    key: { type: 'string', resolvePath: true },
    timeout: { type: 'integer', minimum: 0, default: 1000 },
    retries: { type: 'integer', minimum: 0, default: 3 },
    ttl: { type: 'integer', minimum: 0, default: 10000 },
    lockTtl: { type: 'integer', minimum: 0, default: 500 }
  },
  additionalProperties: false
}

export const gateway = {
  type: 'object',
  properties: {
    applications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          origin: { type: 'string' },
          openapi: openApiApplication,
          graphql: graphqlApplication,
          proxy: {
            anyOf: [
              { type: 'boolean', const: false },
              {
                type: 'object',
                properties: {
                  methods: {
                    type: 'array',
                    // Note: HEAD is purposely not included as it makes sense only if there is a GET route
                    items: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] },
                    default: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
                  },
                  routes: {
                    type: 'array',
                    items: { type: 'string' },
                    default: ['/', '/*']
                  },
                  upstream: { type: 'string' },
                  prefix: { type: 'string' },
                  rewritePrefix: { type: 'string' },
                  rewriteLocationHeader: { type: 'boolean' },
                  hostname: { type: 'string' },
                  custom: {
                    type: 'object',
                    properties: {
                      path: { type: 'string' },
                      options: {
                        type: 'object',
                        additionalProperties: true
                      }
                    },
                    required: ['path'],
                    additionalProperties: false
                  },
                  deduplication,
                  ws: {
                    type: 'object',
                    properties: {
                      upstream: { type: 'string' },
                      reconnect: {
                        type: 'object',
                        properties: {
                          pingInterval: { type: 'number' },
                          maxReconnectionRetries: { type: 'number' },
                          reconnectInterval: { type: 'number' },
                          reconnectDecay: { type: 'number' },
                          connectionTimeout: { type: 'number' },
                          reconnectOnClose: { type: 'boolean' },
                          logs: { type: 'boolean' }
                        }
                      },
                      hooks: {
                        type: 'object',
                        properties: {
                          path: { type: 'string' }
                        },
                        required: ['path'],
                        additionalProperties: false
                      }
                    },
                    required: [],
                    additionalProperties: false
                  }
                },
                required: [],
                additionalProperties: false
              }
            ]
          }
        },
        required: ['id'],
        additionalProperties: false
      }
    },
    handler: { type: 'string' },
    deduplication,
    openapi: openApiBase,
    graphql: graphqlComposerOptions,
    addEmptySchema: { type: 'boolean', default: false },
    refreshTimeout: { type: 'integer', minimum: 0, default: 1000 },
    passthroughContentTypes: {
      type: 'array',
      items: { type: 'string' },
      default: ['multipart/form-data', 'application/octet-stream'],
      description: 'Content types that should be passed through without parsing to enable proxying'
    }
  },
  required: [],
  default: {},
  additionalProperties: false
}

export const types = {
  type: 'object',
  properties: {
    autogenerate: {
      type: 'boolean'
    },
    dir: {
      description: 'The path to the directory the types should be generated in.',
      type: 'string',
      default: 'types',
      resolvePath: true
    }
  },
  additionalProperties: false
}

export const schemaComponents = {
  openApiApplication,
  entityResolver,
  entities,
  graphqlApplication,
  graphqlComposerOptions,
  deduplicationRoute,
  deduplicationStorage,
  deduplication,
  gateway,
  types
}

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/gateway/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Gateway Config',
  type: 'object',
  properties: {
    basePath: {
      type: 'string'
    },
    server,
    gateway,
    types,
    plugins,
    application: basicSchemaComponents.application,
    runtime: wrappedRuntime,
    telemetry: utilsSchemaComponents.telemetry,
    watch: {
      anyOf: [
        watch,
        {
          type: 'boolean'
        },
        {
          type: 'string'
        }
      ]
    },
    $schema: {
      type: 'string'
    },
    module: {
      type: 'string'
    }
  },
  additionalProperties: false,
  $defs
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}
