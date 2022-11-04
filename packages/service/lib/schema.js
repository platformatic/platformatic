'use strict'

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
            type: 'string'
          }
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
  $id: 'https://schemas.platformatic.dev/service/server',
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
    healthCheck: {
      anyOf: [
        { type: 'boolean' },
        {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            interval: { type: 'integer' }
          },
          additionalProperties: false
        }
      ]
    },
    cors
  },
  required: ['hostname', 'port']
}

const plugin = {
  $id: 'https://schemas.platformatic.dev/service/plugin',
  type: 'object',
  properties: {
    path: {
      type: 'string'
    },
    stopTimeout: {
      type: 'integer'
    },
    typescript: {
      type: 'object',
      properties: {
        outDir: {
          type: 'string'
        }
      },
      additionalProperties: false,
      required: ['outDir']
    },
    watch: {
      type: 'boolean'
    },
    watchOptions: {
      type: 'object',
      properties: {
        hotReload: {
          type: 'boolean',
          default: true
        },
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
  },
  required: ['path']
}

const metrics = {
  $id: 'https://schemas.platformatic.dev/db/metrics',
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
  $id: 'https://schemas.platformatic.dev/db',
  type: 'object',
  properties: {
    server,
    plugin,
    metrics
  },
  additionalProperties: false,
  required: ['server']
}

module.exports.schema = platformaticServiceSchema
module.exports.metrics = metrics
module.exports.cors = cors
module.exports.server = server
module.exports.plugin = plugin
