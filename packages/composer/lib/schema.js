#! /usr/bin/env node
'use strict'

const { metrics, server, plugins, watch, clients, openApiBase, openApiDefs, graphqlBase } = require('@platformatic/service').schema
const telemetry = require('@platformatic/telemetry').schema
const pkg = require('../package.json')
const version = 'v' + pkg.version

const openApiService = {
  type: 'object',
  properties: {
    url: { type: 'string' },
    file: { type: 'string', resolvePath: true },
    prefix: { type: 'string' },
    config: { type: 'string', resolvePath: true }
  },
  anyOf: [
    { required: ['url'] },
    { required: ['file'] }
  ],
  additionalProperties: false
}

const entityResolver = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    argsAdapter: { typeof: 'function' },
    partialResults: { typeof: 'function' }
  },
  required: ['name'],
  additionalProperties: false
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
        entities: {
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
                    required: ['type', 'fkey', 'as', 'resolver']
                  }
                }
              }
            }
          }
        }
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
    defaultArgsAdapter: { typeof: 'function' },
    addEntitiesResolvers: { type: 'boolean', const: false }
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
            oneOf: [
              { type: 'boolean', const: false },
              {
                type: 'object',
                properties: {
                  prefix: { type: 'string' }
                },
                required: ['prefix'],
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
    refreshTimeout: { type: 'integer', minimum: 0, default: 1000 }
  },
  required: ['services'],
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

const platformaticComposerSchema = {
  $id: `https://platformatic.dev/schemas/${version}/composer`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    server,
    composer,
    metrics,
    types,
    plugins,
    clients,
    telemetry,
    watch: {
      anyOf: [watch, {
        type: 'boolean'
      }, {
        type: 'string'
      }]
    },
    $schema: {
      type: 'string'
    }
  },
  additionalProperties: false,
  required: ['composer'],
  $defs: openApiDefs
}

module.exports.schema = platformaticComposerSchema

/* c8 ignore next 3 */
if (require.main === module) {
  console.log(JSON.stringify(platformaticComposerSchema, null, 2))
}
