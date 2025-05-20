#!/usr/bin/env node

'use strict'

const pkg = require('../package.json')
const openApiDefs = require('./openapi-schema-defs')
const telemetry = require('@platformatic/telemetry').schema
const { fastifyServer: server, cors, watch, wrappedRuntime } = require('@platformatic/utils').schemaComponents

const plugins = {
  type: 'object',
  properties: {
    packages: {
      type: 'array',
      items: {
        anyOf: [
          {
            type: 'string'
          },
          {
            type: 'object',
            properties: {
              name: {
                type: 'string'
              },
              options: {
                type: 'object',
                additionalProperties: true
              }
            },
            required: ['name']
          }
        ]
      }
    },
    paths: {
      type: 'array',
      items: {
        anyOf: [
          {
            type: 'string',
            resolvePath: true
          },
          {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                resolvePath: true
              },
              encapsulate: {
                type: 'boolean',
                default: true
              },
              maxDepth: {
                type: 'integer'
              },
              autoHooks: {
                type: 'boolean'
              },
              autoHooksPattern: {
                type: 'string'
              },
              cascadeHooks: {
                type: 'boolean'
              },
              overwriteHooks: {
                type: 'boolean'
              },
              routeParams: {
                type: 'boolean'
              },
              forceESM: {
                type: 'boolean'
              },
              ignoreFilter: {
                type: 'string'
              },
              matchFilter: {
                type: 'string'
              },
              ignorePattern: {
                type: 'string'
              },
              scriptPattern: {
                type: 'string'
              },
              indexPattern: {
                type: 'string'
              },
              options: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        ]
      }
    },
    typescript: {
      anyOf: [
        {
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
            tsConfig: {
              type: 'string',
              resolvePath: true
            },
            outDir: {
              type: 'string',
              resolvePath: true
            },
            flags: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          }
        },
        {
          type: 'boolean'
        },
        {
          type: 'string'
        }
      ]
    }
  },
  additionalProperties: false,
  anyOf: [
    {
      required: ['paths']
    },
    {
      required: ['packages']
    }
  ]
}

const metrics = {
  anyOf: [
    { type: 'boolean' },
    {
      type: 'object',
      properties: {
        port: {
          anyOf: [{ type: 'integer' }, { type: 'string' }]
        },
        hostname: { type: 'string' },
        endpoint: { type: 'string' },
        server: {
          type: 'string',
          enum: ['own', 'parent', 'hide']
        },
        defaultMetrics: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' }
          },
          required: ['enabled'],
          additionalProperties: false
        },
        auth: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' }
          },
          additionalProperties: false,
          required: ['username', 'password']
        },
        labels: {
          type: 'object',
          additionalProperties: { type: 'string' }
        }
      },
      additionalProperties: false
    }
  ]
}

const openApiBase = {
  type: 'object',
  properties: {
    info: {
      $ref: '#/$defs/info'
    },
    jsonSchemaDialect: {
      type: 'string',

      default: 'https://spec.openapis.org/oas/3.1/dialect/base'
    },
    servers: {
      type: 'array',
      items: {
        $ref: '#/$defs/server'
      },
      default: [
        {
          url: '/'
        }
      ]
    },
    paths: {
      $ref: '#/$defs/paths'
    },
    webhooks: {
      type: 'object',
      additionalProperties: {
        $ref: '#/$defs/path-item-or-reference'
      }
    },
    components: {
      $ref: '#/$defs/components'
    },
    security: {
      type: 'array',
      items: {
        $ref: '#/$defs/security-requirement'
      }
    },
    tags: {
      type: 'array',
      items: {
        $ref: '#/$defs/tag'
      }
    },
    externalDocs: {
      $ref: '#/$defs/external-documentation'
    },
    swaggerPrefix: {
      type: 'string',
      description: 'Base URL for the OpenAPI Swagger Documentation'
    },
    path: {
      type: 'string',
      description: 'Path to an OpenAPI spec file',
      resolvePath: true
    }
  }
}

const openapi = {
  anyOf: [
    {
      ...openApiBase,
      additionalProperties: false
    },
    {
      type: 'boolean'
    }
  ]
}

// same as composer/proxy
const proxy = {
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

const graphqlBase = {
  type: 'object',
  properties: {
    graphiql: {
      type: 'boolean'
    }
  },
  additionalProperties: false
}

const graphql = {
  anyOf: [
    {
      ...graphqlBase,
      additionalProperties: false
    },
    {
      type: 'boolean'
    }
  ]
}

const service = {
  type: 'object',
  properties: {
    openapi,
    graphql,
    proxy
  },
  additionalProperties: false
}

const clients = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      serviceId: {
        type: 'string'
      },
      name: {
        type: 'string'
      },
      type: {
        type: 'string',
        enum: ['openapi', 'graphql']
      },
      path: {
        type: 'string',
        resolvePath: true
      },
      schema: {
        type: 'string',
        resolvePath: true
      },
      url: {
        type: 'string'
      },
      fullResponse: { type: 'boolean' },
      fullRequest: { type: 'boolean' },
      validateResponse: { type: 'boolean' }
    },
    additionalProperties: false
  }
}

const platformaticServiceSchema = {
  $id: `https://schemas.platformatic.dev/@platformatic/service/${pkg.version}.json`,
  version: pkg.version,
  title: 'Platformatic Service',
  type: 'object',
  properties: {
    basePath: {
      type: 'string'
    },
    server,
    plugins,
    metrics,
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
    },
    service,
    clients,
    runtime: wrappedRuntime
  },
  additionalProperties: false,
  $defs: openApiDefs
}

/*
 * Legacy definitions for backwards compatibility.
 * They are non/enumerable to avoid being included in the schema.
 */
Object.defineProperty(platformaticServiceSchema, 'schema', {
  enumerable: false,
  value: platformaticServiceSchema
})

Object.defineProperty(platformaticServiceSchema, 'server', {
  enumerable: false,
  value: server
})

Object.defineProperty(platformaticServiceSchema, 'cors', {
  enumerable: false,
  value: cors
})

Object.defineProperty(platformaticServiceSchema, 'metrics', {
  enumerable: false,
  value: metrics
})

Object.defineProperty(platformaticServiceSchema, 'plugins', {
  enumerable: false,
  value: plugins
})

Object.defineProperty(platformaticServiceSchema, 'watch', {
  enumerable: false,
  value: watch
})

Object.defineProperty(platformaticServiceSchema, 'openApiDefs', {
  enumerable: false,
  value: openApiDefs
})

Object.defineProperty(platformaticServiceSchema, 'openApiBase', {
  enumerable: false,
  value: openApiBase
})

Object.defineProperty(platformaticServiceSchema, 'graphqlBase', {
  enumerable: false,
  value: graphqlBase
})

Object.defineProperty(platformaticServiceSchema, 'clients', {
  enumerable: false,
  value: clients
})

/* end */

module.exports.schema = platformaticServiceSchema
module.exports.metrics = metrics
module.exports.cors = cors
module.exports.server = server
module.exports.plugins = plugins
module.exports.watch = watch
module.exports.openApiDefs = openApiDefs
module.exports.openApiBase = openApiBase
module.exports.graphqlBase = graphqlBase
module.exports.clients = clients

if (require.main === module) {
  console.log(JSON.stringify(platformaticServiceSchema, null, 2))
}
