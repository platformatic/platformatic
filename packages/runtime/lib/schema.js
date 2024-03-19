#! /usr/bin/env node
'use strict'

const telemetry = require('@platformatic/telemetry').schema
const { server } = require('@platformatic/service').schema
const pkg = require('../package.json')
const version = 'v' + pkg.version
const platformaticRuntimeSchema = {
  $id: `https://platformatic.dev/schemas/${version}/runtime`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    autoload: {
      type: 'object',
      additionalProperties: false,
      required: ['path'],
      properties: {
        path: {
          type: 'string',
          resolvePath: true
        },
        exclude: {
          type: 'array',
          default: [],
          items: {
            type: 'string'
          }
        },
        mappings: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'config'],
            properties: {
              id: {
                type: 'string'
              },
              config: {
                type: 'string'
              },
              useHttp: {
                type: 'boolean'
              }
            }
          }
        }
      }
    },
    telemetry,
    server,
    services: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        required: ['id', 'path', 'config'],
        properties: {
          id: {
            type: 'string'
          },
          path: {
            type: 'string',
            resolvePath: true
          },
          config: {
            type: 'string'
          },
          useHttp: {
            type: 'boolean'
          }
        }
      }
    },
    entrypoint: {
      type: 'string'
    },
    hotReload: {
      anyOf: [
        {
          type: 'boolean'
        },
        {
          type: 'string'
        }
      ]
    },
    allowCycles: {
      type: 'boolean'
    },
    inspectorOptions: {
      type: 'object',
      properties: {
        host: {
          type: 'string'
        },
        port: {
          type: 'number'
        },
        breakFirstLine: {
          type: 'boolean'
        },
        hotReloadDisabled: {
          type: 'boolean'
        }
      }
    },
    undici: {
      type: 'object',
      properties: {
        agentOptions: {
          type: 'object',
          additionalProperties: true
        },
        interceptors: {
          anyOf: [{
            type: 'array',
            items: {
              $ref: '#/$defs/undiciInterceptor'
            }
          }, {
            type: 'object',
            properties: {
              Client: {
                type: 'array',
                items: {
                  $ref: '#/$defs/undiciInterceptor'
                }
              },
              Pool: {
                type: 'array',
                items: {
                  $ref: '#/$defs/undiciInterceptor'
                }
              },
              Agent: {
                type: 'array',
                items: {
                  $ref: '#/$defs/undiciInterceptor'
                }
              }
            }
          }]
        }
      }
    },
    $schema: {
      type: 'string'
    },
    managementApi: {
      anyOf: [
        { type: 'boolean' },
        {
          type: 'object',
          properties: {
            logs: {
              maxSize: {
                type: 'number',
                minimum: 5,
                default: 200
              }
            }
          },
          additionalProperties: false
        }
      ]
    },
    metrics: {
      anyOf: [
        { type: 'boolean' },
        {
          type: 'object',
          properties: {
            port: {
              anyOf: [
                { type: 'integer' },
                { type: 'string' }
              ]
            },
            hostname: { type: 'string' },
            endpoint: { type: 'string' },
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
  },
  anyOf: [
    { required: ['autoload', 'entrypoint'] },
    { required: ['services', 'entrypoint'] }
  ],
  additionalProperties: false,
  $defs: {
    undiciInterceptor: {
      type: 'object',
      properties: {
        module: {
          type: 'string'
        },
        options: {
          type: 'object',
          additionalProperties: true
        }
      },
      required: ['module', 'options']
    }
  }
}

module.exports.schema = platformaticRuntimeSchema

if (require.main === module) {
  console.log(JSON.stringify(platformaticRuntimeSchema, null, 2))
}
