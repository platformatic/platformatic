#!/usr/bin/env node

'use strict'

const pkg = require('../package.json')
const version = 'v' + pkg.version
const openApiDefs = require('./openapi-schema-defs')

const cors = {
  type: 'object',
  $comment: 'See https://github.com/fastify/fastify-cors',
  properties: {
    origin: {
      anyOf: [
        { type: 'boolean' },
        { type: 'string' },
        {
          type: 'array',
          items: {
            anyOf: [{
              type: 'string'
            }, {
              type: 'object',
              properties: {
                regexp: {
                  type: 'string'
                }
              },
              required: ['regexp']
            }]
          }
        },
        {
          type: 'object',
          properties: {
            regexp: {
              type: 'string'
            }
          },
          required: ['regexp']
        }
      ]
    },
    methods: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    allowedHeaders: {
      type: 'string',
      description: 'Comma separated string of allowed headers.'
    },
    exposedHeaders: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'string'
          }
        },
        {
          type: 'string',
          description: 'Comma separated string of exposed headers.'
        }
      ]
    },
    credentials: {
      type: 'boolean'
    },
    maxAge: {
      type: 'integer'
    },
    preflightContinue: {
      type: 'boolean',
      default: false
    },
    optionsSuccessStatus: {
      type: 'integer',
      default: 204
    },
    preflight: {
      type: 'boolean',
      default: true
    },
    strictPreflight: {
      type: 'boolean',
      default: true
    },
    hideOptionsRoute: {
      type: 'boolean',
      default: true
    }
  },
  additionalProperties: false
}

const server = {
  type: 'object',
  properties: {
    // TODO add support for level
    hostname: {
      type: 'string'
    },
    port: {
      anyOf: [
        { type: 'integer' },
        { type: 'string' }
      ]
    },
    pluginTimeout: {
      type: 'integer'
    },
    healthCheck: {
      anyOf: [
        { type: 'boolean' },
        {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            interval: { type: 'integer' }
          },
          additionalProperties: true
        }
      ]
    },
    ignoreTrailingSlash: {
      type: 'boolean'
    },
    ignoreDuplicateSlashes: {
      type: 'boolean'
    },
    connectionTimeout: {
      type: 'integer'
    },
    keepAliveTimeout: {
      type: 'integer'
    },
    maxRequestsPerSocket: {
      type: 'integer'
    },
    forceCloseConnections: {
      anyOf: [
        { type: 'boolean' },
        { type: 'string', pattern: '^idle$' }
      ]
    },
    requestTimeout: {
      type: 'integer'
    },
    bodyLimit: {
      type: 'integer'
    },
    maxParamLength: {
      type: 'integer'
    },
    disableRequestLogging: {
      type: 'boolean'
    },
    exposeHeadRoutes: {
      type: 'boolean'
    },
    logger: {
      anyOf: [
        { type: 'boolean' },
        {
          type: 'object',
          properties: {
            level: {
              type: 'string'
            }
          },
          additionalProperties: true
        }
      ]
    },
    serializerOpts: {
      type: 'object',
      properties: {
        schema: {
          type: 'object'
        },
        ajv: {
          type: 'object'
        },
        rounding: {
          type: 'string',
          enum: ['floor', 'ceil', 'round', 'trunc'],
          default: 'trunc'
        },
        debugMode: {
          type: 'boolean'
        },
        mode: {
          type: 'string',
          enum: ['debug', 'standalone']
        },
        largeArraySize: {
          anyOf: [
            { type: 'integer' },
            { type: 'string' }
          ],
          default: 20000
        },
        largeArrayMechanism: {
          type: 'string',
          enum: ['default', 'json-stringify'],
          default: 'default'
        }
      }
    },
    caseSensitive: {
      type: 'boolean'
    },
    requestIdHeader: {
      anyOf: [
        { type: 'string' },
        { type: 'boolean', const: false }
      ]
    },
    requestIdLogLabel: {
      type: 'string'
    },
    jsonShorthand: {
      type: 'boolean'
    },
    trustProxy: {
      anyOf: [
        { type: 'boolean' },
        { type: 'string' },
        {
          type: 'array',
          items: {
            type: 'string'
          }
        },
        { type: 'integer' }
      ]
    },
    https: {
      type: 'object',
      properties: {
        key: {
          anyOf: [
            {
              type: 'string'
            },
            {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  resolvePath: true
                }
              },
              additionalProperties: false
            },
            {
              type: 'array',
              items: {
                anyOf: [
                  {
                    type: 'string'
                  },
                  {
                    type: 'object',
                    properties: {
                      path: {
                        type: 'string',
                        resolvePath: true
                      }
                    },
                    additionalProperties: false
                  }
                ]
              }
            }
          ]
        },
        cert: {
          anyOf: [
            {
              type: 'string'
            },
            {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  resolvePath: true
                }
              },
              additionalProperties: false
            },
            {
              type: 'array',
              items: {
                anyOf: [
                  {
                    type: 'string'
                  },
                  {
                    type: 'object',
                    properties: {
                      path: {
                        type: 'string',
                        resolvePath: true
                      }
                    },
                    additionalProperties: false
                  }
                ]
              }
            }
          ]
        }
      },
      additionalProperties: false,
      required: ['key', 'cert']
    },
    cors
  },
  required: ['hostname', 'port']
}

const watch = {
  type: 'object',
  properties: {
    allow: {
      type: 'array',
      items: {
        type: 'string'
      },
      minItems: 1,
      nullable: true,
      default: null
    },
    ignore: {
      type: 'array',
      items: {
        type: 'string'
      },
      nullable: true,
      default: null
    }
  },
  additionalProperties: false
}

const plugins = {
  $id: '#plugins',
  type: 'object',
  properties: {
    paths: {
      type: 'array',
      items: {
        anyOf: [{
          type: 'string',
          resolvePath: true
        }, {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              resolvePath: true
            },
            options: {
              type: 'object',
              additionalProperties: true
            }
          }
        }]
      }
    },
    stopTimeout: {
      type: 'integer'
    },
    typescript: {
      type: 'boolean'
    },
    fallback: {
      type: 'boolean'
    },
    hotReload: {
      type: 'boolean',
      default: true
    }
  },
  additionalProperties: false,
  required: ['paths']
}

const metrics = {
  anyOf: [
    { type: 'boolean' },
    {
      type: 'object',
      properties: {
        port: { type: 'integer' },
        hostname: { type: 'string' },
        auth: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' }
          },
          additionalProperties: false,
          required: ['username', 'password']
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
    prefix: {
      type: 'string',
      description: 'Base URL for the OpenAPI'
    }
  }
}

const openapi = {
  anyOf: [{
    ...openApiBase,
    additionalProperties: false
  }, {
    type: 'boolean'
  }]
}

const graphql = {
  anyOf: [{
    type: 'boolean'
  }, {
    type: 'object',
    properties: {
      graphiql: {
        type: 'boolean'
      }
    }
  }]
}

const service = {
  type: 'object',
  properties: {
    openapi,
    graphql
  },
  additionalProperties: false
}

const platformaticServiceSchema = {
  $id: `https://platformatic.dev/schemas/${version}/service`,
  type: 'object',
  properties: {
    server,
    plugins,
    metrics,
    watch: {
      anyOf: [watch, {
        type: 'boolean'
      }]
    },
    hotReload: {
      type: 'boolean'
    },
    $schema: {
      type: 'string'
    },
    service
  },
  additionalProperties: false,
  required: ['server'],
  $defs: openApiDefs
}

module.exports.schema = platformaticServiceSchema
module.exports.metrics = metrics
module.exports.cors = cors
module.exports.server = server
module.exports.plugins = plugins
module.exports.watch = watch
module.exports.openApiDefs = openApiDefs
module.exports.openApiBase = openApiBase

if (require.main === module) {
  console.log(JSON.stringify(platformaticServiceSchema, null, 2))
}
