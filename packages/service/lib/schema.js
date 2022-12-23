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
  $id: 'https://schemas.platformatic.dev/service/watch',
  type: 'object',
  properties: {
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
        },
        build: {
          type: 'boolean',
          default: true
        }
      },
      additionalProperties: false,
      required: ['outDir']
    },
    fallback: {
      type: 'boolean'
    },
    hotReload: {
      type: 'boolean',
      default: true
    },
    options: {
      type: 'object'
    }
  },
  additionalProperties: false,
  required: ['path']
}

const pluginTypes = {
  $id: 'https://schemas.platformatic.dev/service/pluginTypes',
  anyOf: [{
    type: 'array',
    items: {
      anyOf: [{
        $ref: '#/$defs/plugin'
      }, {
        type: 'string'
      }]
    }
  }, {
    $ref: '#/$defs/plugin'
  }, {
    type: 'string'
  }]
}

const metrics = {
  $id: 'https://schemas.platformatic.dev/service/metrics',
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
  $id: 'https://schemas.platformatic.dev/service',
  $defs: {
    plugin
  },
  type: 'object',
  properties: {
    server,
    plugin: pluginTypes,
    metrics
  },
  additionalProperties: {
    watch: {
      anyOf: [watch, {
        type: 'boolean'
      }]
    }
  },
  required: ['server']
}

module.exports.schema = platformaticServiceSchema
module.exports.metrics = metrics
module.exports.cors = cors
module.exports.server = server
module.exports.plugin = plugin
module.exports.pluginTypes = pluginTypes
module.exports.watch = watch
