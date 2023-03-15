#!/usr/bin/env node

'use strict'

const pkg = require('../package.json')
const version = 'v' + pkg.version

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
          type: 'string'
        }, {
          type: 'object',
          properties: {
            path: {
              type: 'string'
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

const openapi = {
  anyOf: [{
    type: 'object',
    properties: {
      info: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          version: { type: 'string' },
          additionalProperties: false
        }
      },
      prefix: {
        type: 'string',
        description: 'Base URL for the OpenAPI'
      },
      ignore: {
        type: 'object',
        // TODO add support for column-level ignore
        additionalProperties: {
          type: 'boolean'
        }
      }
    },
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
  required: ['server']
}

module.exports.schema = platformaticServiceSchema
module.exports.metrics = metrics
module.exports.cors = cors
module.exports.server = server
module.exports.plugins = plugins
module.exports.watch = watch

if (require.main === module) {
  console.log(JSON.stringify(platformaticServiceSchema, null, 2))
}
