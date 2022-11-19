'use strict'

const { metrics, server, plugin } = require('@platformatic/service').schema

const core = {
  $id: 'https://schemas.platformatic.dev/db/core',
  type: 'object',
  properties: {
    connectionString: {
      type: 'string'
    },
    schema: {
      type: 'array',
      items: {
        type: 'string'
      }
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
          },
          subscriptionIgnore: {
            type: 'array',
            items: {
              type: 'string'
            }
          }
        }
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
    },
    events: {
      anyOf: [{
        type: 'boolean'
      }, {
        type: 'object',
        properties: {
          connectionString: {
            type: 'string'
          }
        },
        additionalProperties: false
      }]
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
        namespace: {
          type: 'string',
          description: 'the namespace for JWT custom claims'
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
