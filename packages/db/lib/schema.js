#! /usr/bin/env node

import { schemaComponents as serviceSchemaComponents } from '@platformatic/service'
import { fastifyServer as server, schemaComponents as utilsSchemaComponents, watch, wrappedRuntime } from '@platformatic/utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'))
export const version = packageJson.version

const { plugins, openApiBase, clients, $defs } = serviceSchemaComponents

export const db = {
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
      oneOf: [
        {
          type: 'boolean',
          default: false
        },
        {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              resolvePath: true
            }
          }
        }
      ]
    },
    poolSize: {
      type: 'integer'
    },
    idleTimeoutMilliseconds: {
      type: 'integer'
    },
    queueTimeoutMilliseconds: {
      type: 'integer'
    },
    acquireLockTimeoutMilliseconds: {
      type: 'integer'
    },
    autoTimestamp: {
      oneOf: [
        {
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
        },
        {
          type: 'boolean'
        }
      ]
    },
    graphql: {
      anyOf: [
        {
          type: 'boolean'
        },
        {
          type: 'object',
          properties: {
            graphiql: {
              type: 'boolean'
            },
            include: {
              type: 'object',
              additionalProperties: {
                type: 'boolean'
              }
            },
            ignore: {
              type: 'object',
              additionalProperties: {
                anyOf: [
                  {
                    type: 'boolean'
                  },
                  {
                    type: 'object',
                    additionalProperties: {
                      type: 'boolean'
                    }
                  }
                ]
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
            },
            enabled: {
              anyOf: [{ type: 'boolean' }, { type: 'string' }]
            }
          }
        }
      ]
    },
    openapi: {
      anyOf: [
        {
          type: 'boolean'
        },
        {
          type: 'object',
          properties: {
            ...openApiBase.properties,
            allowPrimaryKeysInInput: {
              type: 'boolean',
              default: true
            },
            include: {
              type: 'object',
              additionalProperties: {
                type: 'boolean'
              }
            },
            ignore: {
              type: 'object',
              additionalProperties: {
                anyOf: [
                  {
                    type: 'boolean'
                  },
                  {
                    type: 'object',
                    additionalProperties: {
                      type: 'boolean'
                    }
                  }
                ]
              }
            },
            ignoreRoutes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  method: { type: 'string' },
                  path: { type: 'string' }
                },
                required: ['method', 'path'],
                additionalProperties: false
              }
            },
            enabled: {
              anyOf: [{ type: 'boolean' }, { type: 'string' }]
            },
            swaggerPrefix: {
              type: 'string',
              description: 'Base URL for the OpenAPI Swagger Documentation'
            },
            prefix: {
              type: 'string',
              description: 'Base URL for generated Platformatic DB routes'
            }
          },
          additionalProperties: false
        }
      ]
    },
    include: {
      type: 'object',
      additionalProperties: {
        type: 'boolean'
      }
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
      anyOf: [
        {
          type: 'boolean'
        },
        {
          type: 'object',
          properties: {
            connectionString: {
              type: 'string'
            },
            enabled: {
              anyOf: [{ type: 'boolean' }, { type: 'string' }]
            }
          },
          additionalProperties: false
        }
      ]
    },
    cache: {
      type: 'boolean'
    }
  },
  required: ['connectionString']
}

export const sharedAuthorizationRule = {
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
    $ref: '#/$defs/crud-operation-auth'
  },
  save: {
    $ref: '#/$defs/crud-operation-auth'
  },
  delete: {
    $ref: '#/$defs/crud-operation-auth'
  },
  updateMany: {
    $ref: '#/$defs/crud-operation-auth'
  }
}

export const authorization = {
  type: 'object',
  properties: {
    adminSecret: {
      type: 'string',
      description:
        'The password should be used to access routes under /_admin prefix and for admin access to REST and GraphQL endpoints with X-PLATFORMATIC-ADMIN-SECRET header.'
    },
    roleKey: {
      type: 'string',
      description: 'The user metadata key to store user roles',
      default: 'X-PLATFORMATIC-ROLE'
    },
    rolePath: {
      type: 'string',
      description: 'The user metadata path to store user roles'
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
          oneOf: [
            {
              type: 'string',
              description: 'the shared secret for JWT'
            },
            {
              type: 'object',
              description: 'the JWT secret configuration (see: https://github.com/fastify/fastify-jwt#secret-required)',
              additionalProperties: true
            }
          ]
        },
        namespace: {
          type: 'string',
          description: 'the namespace for JWT custom claims'
        },
        jwks: {
          oneOf: [
            {
              type: 'boolean'
            },
            {
              // shall we replicate here all the options in https://github.com/nearform/get-jwks#options
              type: 'object',
              additionalProperties: true
            }
          ]
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
        oneOf: [
          {
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
          },
          {
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
          }
        ]
      }
    }
  },
  additionalProperties: false
}

export const migrations = {
  type: 'object',
  properties: {
    dir: {
      type: 'string',
      resolvePath: true,
      description: 'The path to the directory containing the migrations.'
    },
    table: {
      type: 'string',
      description: 'Table created to track schema version.',
      default: 'versions'
    },
    validateChecksums: {
      type: 'boolean'
    },
    autoApply: {
      description: 'Whether to automatically apply migrations when running the migrate command.',
      anyOf: [
        {
          type: 'boolean',
          default: false
        },
        {
          type: 'string'
        }
      ]
    },
    newline: {
      type: 'string',
      description:
        'Force line ending on file when generating checksum. Value should be either CRLF (windows) or LF (unix/mac).'
    },
    currentSchema: {
      type: 'string',
      description:
        "For Postgres and MS SQL Server(will ignore for another DBs). Specifies schema to look to when validating `versions` table columns. For Postgres, run's `SET search_path = currentSchema` prior to running queries against db."
    }
  },
  additionalProperties: false,
  required: ['dir']
}

export const types = {
  type: 'object',
  properties: {
    autogenerate: {
      anyOf: [
        {
          type: 'string'
        },
        {
          type: 'boolean'
        }
      ],
      description: 'Should types be auto generated.'
    },
    dir: {
      type: 'string',
      resolvePath: true,
      description: 'The path to the directory the types should be generated in.'
    }
  },
  additionalProperties: false
}

export const schemaComponents = {
  db,
  sharedAuthorizationRule,
  authorization,
  migrations,
  types
}

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/db/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Database Config',
  type: 'object',
  properties: {
    basePath: {
      type: 'string'
    },
    server: {
      ...server,
      properties: {
        ...server.properties,
        pluginTimeout: {
          ...server.properties.pluginTimeout,
          default: 60 * 1000
        }
      }
    },
    db,
    authorization,
    migrations,
    types,
    plugins,
    telemetry: utilsSchemaComponents.telemetry,
    clients,
    runtime: wrappedRuntime,
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
    }
  },
  additionalProperties: false,
  required: ['db'],
  $defs: {
    ...$defs,
    'crud-operation-auth': {
      oneOf: [
        {
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
        },
        {
          type: 'boolean',
          description: 'true if enabled (with not authorization constraints enabled)'
        }
      ]
    }
  }
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}
