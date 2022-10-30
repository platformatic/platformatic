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
  $id: 'https://schemas.platformatic.dev/db/server',
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

const core = {
  $id: 'https://schemas.platformatic.dev/db/core',
  type: 'object',
  properties: {
    connectionString: {
      type: 'string'
    },
    poolSize: {
      type: 'integer'
    },
    graphql: {
      anyOf: [{
        type: 'boolean'
      }, {
        type: 'object',
        properties: {
          graphiql: {
            type: 'boolean'
          }
        },
        additionalProperties: false
      }]
    },
    openapi: {
      anyOf: [{
        type: 'boolean'
      }, {
        type: 'object',
        properties: {
          info: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              version: { type: 'string' }
            }
          },
          prefix: {
            type: 'string',
            description: 'Base URL for the OpenAPI'
          }
        },
        additionalProperties: false
      }]
    },
    ignore: {
      type: 'object',
      // TODO add support for column-level ignore
      additionalProperties: {
        type: 'boolean'
      }
    }
  },
  additionalProperties: false,
  required: ['connectionString']
}

const authorization = {
  $id: 'https://schemas.platformatic.dev/db/authorization',
  type: 'object',
  properties: {
    adminSecret: {
      type: 'string',
      description: 'The password should be used to login dashboard and to access routes under /_admin prefix and for admin access to REST and GraphQL endpoints with X-PLATFORMATIC-ADMIN-SECRET header.'
    },
    roleKey: {
      type: 'string',
      description: 'The user metadata key to store user roles',
      default: 'X-PLATFORMATIC-ROLE'
    },
    anonymousRole: {
      type: 'string',
      description: 'The role name for anonymous users',
      default: 'anonymous'
    },
    jwt: {
      type: 'object',
      properties: {
        secret: {
          type: 'string',
          description: 'the shared secret for JWT'
        },
        jwks: {
          oneOf: [{
            type: 'boolean'
          }, {
            // shall we replicate here all the options in https://github.com/nearform/get-jwks#options
            type: 'object',
            additionalProperties: true
          }]
        }
      }
    },
    webhook: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'the webhook url'
        }
      },
      additionalProperties: false
    },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            description: 'the role name to match the rule'
          },
          entity: {
            type: 'string',
            description: 'the DB entity type to which the rule applies'
          },
          defaults: {
            type: 'object',
            description: 'defaults for entity creation',
            additionalProperties: {
              type: 'string'
            }
          },
          find: {
            $ref: '#crud-operation-auth'
          },
          save: {
            $ref: '#crud-operation-auth'
          },
          delete: {
            $ref: '#crud-operation-auth'
          }
        },
        required: ['role', 'entity'],
        additionalProperties: false
      }
    }
  },
  additionalProperties: false,
  $defs: {
    crudOperationAuth: {
      $id: '#crud-operation-auth',
      oneOf: [{
        type: 'object',
        description: 'CRUD operation authorization config',
        properties: {
          checks: {
            description: 'checks for the operation',
            type: 'object',
            additionalProperties: {
              if: {
                type: 'object'
              },
              then: {
                type: 'object',
                properties: {
                  eq: { type: 'string' },
                  in: { type: 'string' },
                  nin: { type: 'string' },
                  nen: { type: 'string' },
                  gt: { type: 'string' },
                  gte: { type: 'string' },
                  lt: { type: 'string' },
                  lte: { type: 'string' }
                },
                additionalProperties: false
              },
              else: {
                type: 'string'
              }
            }
          },
          fields: {
            type: 'array',
            description: 'array of enabled field for the operation',
            items: {
              type: 'string'
            }
          }
        },
        additionalProperties: false
      }, {
        type: 'boolean',
        description: 'true if enabled (with not authorization constraints enabled)'
      }]
    }
  }
}

const dashboard = {
  $id: 'https://schemas.platformatic.dev/db/dashboard',
  anyOf: [
    { type: 'boolean' },
    {
      type: 'object',
      properties: {
        rootPath: {
          type: 'boolean',
          description: 'Whether the dashboard should be served on / path or not.'
        }
      },
      additionalProperties: false
    }
  ]
}

const migrations = {
  $id: 'https://schemas.platformatic.dev/db/migrations',
  type: 'object',
  properties: {
    dir: {
      type: 'string',
      description: 'The path to the directory containing the migrations.'
    },
    table: {
      type: 'string'
    },
    validateChecksums: {
      type: 'boolean'
    },
    autoApply: {
      type: 'boolean',
      description: 'Whether to automatically apply migrations when running the migrate command.'
    }
  },
  additionalProperties: false,
  required: ['dir']
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

const types = {
  $id: 'https://schemas.platformatic.dev/db/types',
  type: 'object',
  properties: {
    autogenerate: {
      type: 'boolean'
    }
  },
  additionalProperties: false
}

const plugin = {
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

const platformaticDBschema = {
  $id: 'https://schemas.platformatic.dev/db',
  type: 'object',
  properties: {
    server,
    core,
    dashboard,
    authorization,
    migrations,
    metrics,
    types,
    plugin
  },
  additionalProperties: false,
  required: ['core', 'server']
}

module.exports.schema = platformaticDBschema
