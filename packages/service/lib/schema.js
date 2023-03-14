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
    }
  },
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
