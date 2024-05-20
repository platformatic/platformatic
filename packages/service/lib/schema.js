#!/usr/bin/env node

'use strict'

const pkg = require('../package.json')
const openApiDefs = require('./openapi-schema-defs')
const telemetry = require('@platformatic/telemetry').schema

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
      type: 'integer',
      default: 5000
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
            },
            transport: {
              anyOf: [{
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
              }, {
                type: 'object',
                properties: {
                  targets: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        target: {
                          type: 'string',
                          resolveModule: true
                        },
                        options: {
                          type: 'object'
                        },
                        level: {
                          type: 'string'
                        },
                        additionalProperties: false
                      }
                    }
                  },
                  options: {
                    type: 'object'
                  }
                },
                additionalProperties: false
              }]
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
    https: {
      type: 'object',
      properties: {
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

const watch = {
  type: 'object',
  properties: {
    enabled: {
      default: true,
      anyOf: [{
        type: 'boolean'
      }, {
        type: 'string'
      }]
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

const plugins = {
  type: 'object',
  properties: {
    packages: {
      type: 'array',
      items: {
        anyOf: [{
          type: 'string'
        }, {
          type: 'object',
          properties: {
            name: {
              type: 'string'
            },
            options: {
              type: 'object',
              additionalProperties: true
            }
          },
          required: ['name']
        }]
      }
    },
    paths: {
      type: 'array',
      items: {
        anyOf: [{
          type: 'string',
          resolvePath: true
        }, {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              resolvePath: true
            },
            encapsulate: {
              type: 'boolean',
              default: true
            },
            maxDepth: {
              type: 'integer'
            },
            autoHooks: {
              type: 'boolean'
            },
            autoHooksPattern: {
              type: 'string'
            },
            cascadeHooks: {
              type: 'boolean'
            },
            overwriteHooks: {
              type: 'boolean'
            },
            routeParams: {
              type: 'boolean'
            },
            forceESM: {
              type: 'boolean'
            },
            ignoreFilter: {
              type: 'string'
            },
            matchFilter: {
              type: 'string'
            },
            ignorePattern: {
              type: 'string'
            },
            scriptPattern: {
              type: 'string'
            },
            indexPattern: {
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
    typescript: {
      anyOf: [{
        type: 'object',
        properties: {
          enabled: {
            anyOf: [{
              type: 'boolean'
            }, {
              type: 'string'
            }]
          },
          tsConfig: {
            type: 'string',
            resolvePath: true
          },
          outDir: {
            type: 'string',
            resolvePath: true
          },
          flags: {
            type: 'array',
            items: {
              type: 'string'
            }
          }
        }
      }, {
        type: 'boolean'
      }, {
        type: 'string'
      }]
    }
  },
  additionalProperties: false,
  anyOf: [{
    required: ['paths']
  }, {
    required: ['packages']
  }]
}

const metrics = {
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
        server: {
          type: 'string',
          enum: ['own', 'parent', 'hide']
        },
        defaultMetrics: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' }
          },
          required: ['enabled'],
          additionalProperties: false
        },
        prefix: { type: 'string' },
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

const openApiBase = {
  type: 'object',
  properties: {
    info: {
      $ref: '#/$defs/info'
    },
    jsonSchemaDialect: {
      type: 'string',

      default: 'https://spec.openapis.org/oas/3.1/dialect/base'
    },
    servers: {
      type: 'array',
      items: {
        $ref: '#/$defs/server'
      },
      default: [
        {
          url: '/'
        }
      ]
    },
    paths: {
      $ref: '#/$defs/paths'
    },
    webhooks: {
      type: 'object',
      additionalProperties: {
        $ref: '#/$defs/path-item-or-reference'
      }
    },
    components: {
      $ref: '#/$defs/components'
    },
    security: {
      type: 'array',
      items: {
        $ref: '#/$defs/security-requirement'
      }
    },
    tags: {
      type: 'array',
      items: {
        $ref: '#/$defs/tag'
      }
    },
    externalDocs: {
      $ref: '#/$defs/external-documentation'
    },
    swaggerPrefix: {
      type: 'string',
      description: 'Base URL for the OpenAPI Swagger Documentation'
    },
    path: {
      type: 'string',
      description: 'Path to an OpenAPI spec file',
      resolvePath: true
    }
  }
}

const openapi = {
  anyOf: [{
    ...openApiBase,
    additionalProperties: false
  }, {
    type: 'boolean'
  }]
}

const graphqlBase = {
  type: 'object',
  properties: {
    graphiql: {
      type: 'boolean'
    }
  },
  additionalProperties: false
}

const graphql = {
  anyOf: [{
    ...graphqlBase,
    additionalProperties: false
  }, {
    type: 'boolean'
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

const clients = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      serviceId: {
        type: 'string'
      },
      name: {
        type: 'string'
      },
      type: {
        type: 'string',
        enum: ['openapi', 'graphql']
      },
      path: {
        type: 'string',
        resolvePath: true
      },
      schema: {
        type: 'string',
        resolvePath: true
      },
      url: {
        type: 'string'
      }
    },
    additionalProperties: false
  }
}

const version = {
  type: 'object',
  properties: {
    version: { type: 'string' },
    openapi: {
      type: 'object',
      properties: {
        prefix: {
          type: 'string'
        },
        path: {
          type: 'string',
          resolvePath: true
        }
      },
      additionalProperties: false
    },
    plugins
  },
  required: ['version'],
  additionalProperties: false
}

const versions = {
  type: 'object',
  properties: {
    dir: {
      type: 'string',
      description: 'The path to the directory containing the versions mappers',
      resolvePath: true,
      default: 'versions'
    },
    configs: {
      type: 'array',
      items: version
    }
  },
  required: ['dir', 'configs'],
  additionalProperties: false
}

const platformaticServiceSchema = {
  $id: `https://platformatic.dev/schemas/v${pkg.version}/service`,
  version: pkg.version,
  title: 'Platformatic Service',
  type: 'object',
  properties: {
    server,
    plugins,
    metrics,
    telemetry,
    watch: {
      anyOf: [watch, {
        type: 'boolean'
      }, {
        type: 'string'
      }]
    },
    $schema: {
      type: 'string'
    },
    service,
    clients,
    versions
  },
  additionalProperties: false,
  $defs: openApiDefs
}

module.exports.schema = platformaticServiceSchema
module.exports.metrics = metrics
module.exports.cors = cors
module.exports.server = server
module.exports.plugins = plugins
module.exports.watch = watch
module.exports.openApiDefs = openApiDefs
module.exports.openApiBase = openApiBase
module.exports.graphqlBase = graphqlBase
module.exports.clients = clients

if (require.main === module) {
  console.log(JSON.stringify(platformaticServiceSchema, null, 2))
}
