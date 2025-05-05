'use strict'

function overridableValue (spec, defaultValue) {
  return {
    default: defaultValue,
    anyOf: [spec, { type: 'string' }]
  }
}

function removeDefaults (schema) {
  const cloned = structuredClone(schema)

  for (const value of Object.values(cloned.properties)) {
    delete value.default
  }

  return cloned
}

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
            anyOf: [
              {
                type: 'string'
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

const logger = {
  type: 'object',
  properties: {
    level: {
      type: 'string',
      default: 'info',
      oneOf: [
        {
          enum: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']
        },
        { pattern: '^\\{.+\\}$' }
      ]
    },
    transport: {
      anyOf: [
        {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              resolveModule: true
            },
            options: {
              type: 'object'
            }
          },
          additionalProperties: false
        },
        {
          type: 'object',
          properties: {
            targets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  target: {
                    anyOf: [
                      { type: 'string', resolveModule: true },
                      { type: 'string', resolvePath: true }
                    ]
                  },
                  options: {
                    type: 'object'
                  },
                  level: {
                    type: 'string'
                  }
                },
                additionalProperties: false
              }
            },
            options: {
              type: 'object'
            }
          },
          additionalProperties: false
        }
      ]
    },
    pipeline: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          resolveModule: true
        },
        options: {
          type: 'object'
        }
      },
      additionalProperties: false
    },
    formatters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          resolvePath: true
        }
      },
      required: ['path'],
      additionalProperties: false
    },

    timestamp: {
      enum: ['epochTime', 'unixTime', 'nullTime', 'isoTime']
    },

    redact: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' }
        },
        censor: {
          type: 'string',
          default: '[redacted]'
        }
      },
      required: ['paths'],
      additionalProperties: false
    }
  },

  required: ['level'],
  default: {},
  additionalProperties: true
}

const watch = {
  type: 'object',
  properties: {
    enabled: {
      default: true,
      anyOf: [
        {
          type: 'boolean'
        },
        {
          type: 'string'
        }
      ]
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

const health = {
  type: 'object',
  default: {},
  properties: {
    enabled: overridableValue({ type: 'boolean' }, true),
    interval: overridableValue({ type: 'number', minimum: 0 }, 30000),
    gracePeriod: overridableValue({ type: 'number', minimum: 0 }, 30000),
    maxUnhealthyChecks: overridableValue({ type: 'number', minimum: 1 }, 10),
    maxELU: overridableValue({ type: 'number', minimum: 0, maximum: 1 }, 0.99),
    maxHeapUsed: overridableValue({ type: 'number', minimum: 0, maximum: 1 }, 0.99),
    maxHeapTotal: overridableValue({ type: 'number', minimum: 0 }, 4 * Math.pow(1024, 3)),
    maxYoungGeneration: { type: 'number', minimum: 0 }
  },
  additionalProperties: false
}

const healthWithoutDefaults = removeDefaults(health)

const server = {
  type: 'object',
  properties: {
    hostname: {
      type: 'string',
      default: '127.0.0.1'
    },
    port: {
      anyOf: [{ type: 'integer' }, { type: 'string' }]
    },
    http2: {
      type: 'boolean'
    },
    https: {
      type: 'object',
      properties: {
        allowHTTP1: {
          type: 'boolean'
        },
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
        },
        requestCert: {
          type: 'boolean'
        },
        rejectUnauthorized: {
          type: 'boolean'
        }
      },
      additionalProperties: false,
      required: ['key', 'cert']
    },
  },
  additionalProperties: false
}

const fastifyServer = {
  type: 'object',
  properties: {
    // TODO add support for level
    hostname: {
      type: 'string'
    },
    port: {
      anyOf: [{ type: 'integer' }, { type: 'string' }]
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
      type: 'integer',
      default: 5000
    },
    maxRequestsPerSocket: {
      type: 'integer'
    },
    forceCloseConnections: {
      anyOf: [{ type: 'boolean' }, { type: 'string', pattern: '^idle$' }]
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
      anyOf: [{ type: 'boolean' }, logger]
    },
    loggerInstance: {
      type: 'object'
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
          anyOf: [{ type: 'integer' }, { type: 'string' }],
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
      anyOf: [{ type: 'string' }, { type: 'boolean', const: false }]
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
    http2: {
      type: 'boolean'
    },
    https: {
      type: 'object',
      properties: {
        allowHTTP1: {
          type: 'boolean'
        },
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
        },
        requestCert: {
          type: 'boolean'
        },
        rejectUnauthorized: {
          type: 'boolean'
        }
      },
      additionalProperties: false,
      required: ['key', 'cert']
    },
    cors
  },
  additionalProperties: false
}

module.exports.server = server
module.exports.fastifyServer = fastifyServer
module.exports.cors = cors
module.exports.logger = logger
module.exports.watch = watch
module.exports.health = health
module.exports.healthWithoutDefaults = healthWithoutDefaults
