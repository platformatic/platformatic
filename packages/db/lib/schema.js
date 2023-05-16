#! /usr/bin/env node
'use strict'

const { metrics, server, plugins, watch, openApiDefs, openApiBase, clients } = require('@platformatic/service').schema
const pkg = require('../package.json')
const version = 'v' + pkg.version

const db = {
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
    schemalock: {
      oneOf: [{
        type: 'boolean',
        default: false
      }, {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            resolvePath: true
          }
        }
      }]
    },
    poolSize: {
      type: 'integer'
    },
    autoTimestamp: {
      oneOf: [{
        type: 'object',
        properties: {
          createdAt: {
            type: 'string',
            default: 'created_at'
          },
          updatedAt: {
            type: 'string',
            default: 'updated_at'
          }
        }
      }, {
        type: 'boolean'
      }]
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
          ignore: {
            type: 'object',
            // TODO add support for column-level ignore
            additionalProperties: {
              type: 'boolean'
            }
          },
          subscriptionIgnore: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          schema: {
            type: 'string'
          },
          schemaPath: {
            type: 'string',
            resolvePath: true
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
          ...(openApiBase.properties),
          ignore: {
            type: 'object',
            // TODO add support for column-level ignore
            additionalProperties: {
              type: 'boolean'
            }
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
    limit: {
      type: 'object',
      properties: {
        default: {
          type: 'integer',
          default: 10
        },
        max: {
          type: 'integer',
          default: 100
        }
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
  required: ['connectionString']
}

const sharedAuthorizationRule = {
  role: {
    type: 'string',
    description: 'the role name to match the rule'
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
}

const authorization = {
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
      additionalProperties: true,
      properties: {
        secret: {
          oneOf: [{
            type: 'string',
            description: 'the shared secret for JWT'
          }, {
            type: 'object',
            description: 'the JWT secret configuration (see: https://github.com/fastify/fastify-jwt#secret-required)',
            additionalProperties: true
          }]
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
        oneOf: [{
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              description: 'the DB entity type to which the rule applies'
            },
            ...sharedAuthorizationRule
          },
          required: ['role'],
          additionalProperties: false
        }, {
          type: 'object',
          properties: {
            entities: {
              type: 'array',
              description: 'the DB entity types to which the rule applies',
              items: {
                type: 'string'
              }
            },
            ...sharedAuthorizationRule
          },
          required: ['role'],
          additionalProperties: false
        }]
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
  anyOf: [
    { type: 'boolean' },
    {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path where the dashboard should be served.'
        }
      },
      additionalProperties: false
    }
  ]
}

const migrations = {
  type: 'object',
  properties: {
    dir: {
      type: 'string',
      resolvePath: true,
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
  type: 'object',
  properties: {
    autogenerate: {
      type: 'boolean'
    },
    dir: {
      type: 'string',
      resolvePath: true,
      description: 'The path to the directory the types should be generated in.'
    }
  },
  additionalProperties: false
}

const platformaticDBschema = {
  $id: `https://platformatic.dev/schemas/${version}/db`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    server,
    db,
    dashboard,
    authorization,
    migrations,
    metrics,
    types,
    plugins,
    clients,
    watch: {
      anyOf: [watch, {
        type: 'boolean'
      }]
    },
    $schema: {
      type: 'string'
    }
  },
  additionalProperties: false,
  required: ['db', 'server'],
  $defs: openApiDefs
}

module.exports.schema = platformaticDBschema

if (require.main === module) {
  console.log(JSON.stringify(platformaticDBschema, null, 2))
}
