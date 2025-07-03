#! /usr/bin/env node
'use strict'

const {
  schemaComponents: { server, plugins, watch, clients, openApiBase, graphqlBase, $defs }
} = require('@platformatic/service')
const { schemaComponents } = require('@platformatic/utils')
const telemetry = require('@platformatic/telemetry').schema
const packageJson = require('../package.json')

const openApiService = {
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

const entityResolver = {
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

const entities = {
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

const graphqlService = {
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

const graphqlComposerOptions = {
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

const composer = {
  type: 'object',
  properties: {
    services: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          origin: { type: 'string' },
          openapi: openApiService,
          graphql: graphqlService,
          proxy: {
            anyOf: [
              { type: 'boolean', const: false },
              {
                type: 'object',
                properties: {
                  upstream: { type: 'string' },
                  prefix: { type: 'string' },
                  hostname: { type: 'string' },
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
    openapi: openApiBase,
    graphql: graphqlComposerOptions,
    addEmptySchema: { type: 'boolean', default: false },
    refreshTimeout: { type: 'integer', minimum: 0, default: 1000 }
  },
  required: [],
  default: {},
  additionalProperties: false
}

const types = {
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

const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/composer/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Composer',
  type: 'object',
  properties: {
    basePath: {
      type: 'string'
    },
    server,
    composer,
    types,
    plugins,
    clients,
    runtime: schemaComponents.wrappedRuntime,
    telemetry,
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

module.exports = {
  packageJson,
  schema,
  openApiService,
  entityResolver,
  entities,
  graphqlService,
  graphqlComposerOptions,
  composer,
  types
}

/* c8 ignore next 3 */
if (require.main === module) {
  console.log(JSON.stringify(schema, null, 2))
}
