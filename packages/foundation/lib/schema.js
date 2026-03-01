export function overridableValue (spec, defaultValue) {
  const res = {
    anyOf: [spec, { type: 'string' }]
  }

  if (defaultValue !== undefined) {
    res.default = defaultValue
  }

  return res
}

export function removeDefaults (schema) {
  const cloned = structuredClone(schema)

  for (const value of Object.values(cloned.properties)) {
    delete value.default
  }

  return cloned
}

export function omitProperties (obj, properties) {
  if (!Array.isArray(properties)) {
    properties = [properties]
  }

  const omitted = structuredClone(obj)
  for (const prop of properties) {
    delete omitted[prop]
  }
  return omitted
}

export const env = {
  type: 'object',
  additionalProperties: {
    type: 'string'
  }
}

export const workers = {
  anyOf: [
    {
      type: 'number',
      minimum: 1
    },
    { type: 'string' },
    {
      type: 'object',
      properties: {
        static: { type: 'number', minimum: 1 },
        dynamic: { type: 'boolean', default: false },
        minimum: { type: 'number', minimum: 1 },
        maximum: { type: 'number', minimum: 0 },
        total: { type: 'number', minimum: 1 },
        maxMemory: { type: 'number', minimum: 0 },
        cooldown: { type: 'number', minimum: 0 },
        gracePeriod: { type: 'number', minimum: 0 },
        scaleUpELU: { type: 'number', minimum: 0, maximum: 1 },
        scaleDownELU: { type: 'number', minimum: 0, maximum: 1 }
      }
    }
  ]
}

const verticalScaler = {
  type: 'object',
  properties: {
    enabled: { type: 'boolean', default: true },
    maxTotalWorkers: { type: 'number', minimum: 1 },
    maxTotalMemory: { type: 'number', minimum: 0 },
    minWorkers: { type: 'number', minimum: 1 },
    maxWorkers: { type: 'number', minimum: 1 },
    cooldownSec: { type: 'number', minimum: 0 },
    gracePeriod: { type: 'number', minimum: 0 },
    scaleUpELU: { type: 'number', minimum: 0, maximum: 1 },
    scaleDownELU: { type: 'number', minimum: 0, maximum: 1 },
    timeWindowSec: { type: 'number', minimum: 0, deprecated: true },
    scaleDownTimeWindowSec: { type: 'number', minimum: 0, deprecated: true },
    scaleIntervalSec: { type: 'number', minimum: 0, deprecated: true }
  },
  additionalProperties: false
}

export const preload = {
  anyOf: [
    { type: 'string', resolvePath: true },
    {
      type: 'array',
      items: {
        type: 'string',
        resolvePath: true
      }
    }
  ]
}

export const watch = {
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

export const cors = {
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

export const logger = {
  type: 'object',
  properties: {
    level: {
      type: 'string',
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
    },
    base: {
      anyOf: [{ type: 'object', additionalProperties: true }, { type: 'null' }]
    },
    messageKey: {
      type: 'string'
    },
    customLevels: {
      type: 'object',
      additionalProperties: true
    },
    openTelemetryExporter: {
      type: 'object',
      properties: {
        protocol: {
          type: 'string',
          enum: ['grpc', 'http']
        },
        url: {
          type: 'string'
        }
      },
      required: ['protocol', 'url'],
      additionalProperties: false
    }
  },
  default: {},
  additionalProperties: true
}

export const server = {
  type: 'object',
  properties: {
    hostname: {
      type: 'string',
      default: '127.0.0.1'
    },
    port: {
      anyOf: [{ type: 'integer' }, { type: 'string' }]
    },
    backlog: {
      type: 'integer',
      description: 'The maximum length of the queue of pending connections'
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
    }
  },
  additionalProperties: false
}

export const fastifyServer = {
  type: 'object',
  properties: {
    // TODO add support for level
    hostname: {
      type: 'string'
    },
    port: server.properties.port,
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
    http2: server.properties.http2,
    https: server.properties.https,
    cors
  },
  additionalProperties: false
}

export const undiciInterceptor = {
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

export const health = {
  type: 'object',
  default: {},
  properties: {
    enabled: overridableValue({ type: 'boolean' }, true),
    interval: overridableValue({ type: 'number', minimum: 0 }, 30000),
    gracePeriod: overridableValue({ type: 'number', minimum: 0 }, 30000),
    maxUnhealthyChecks: overridableValue({ type: 'number', minimum: 1 }, 10),
    maxELU: overridableValue({ type: 'number', minimum: 0, maximum: 1 }, 0.99),
    maxHeapUsed: overridableValue({ type: 'number', minimum: 0, maximum: 1 }, 0.99),
    maxHeapTotal: overridableValue({ type: 'number', minimum: 0 }, 4 * Math.pow(1024, 3)), // 4GB
    maxYoungGeneration: overridableValue({ type: 'number', minimum: 0 }, 128 * Math.pow(1024, 2)), // 128MB,
    codeRangeSize: overridableValue({ type: 'number', minimum: 0 }, 268435456)
  },
  additionalProperties: false
}

export const healthWithoutDefaults = removeDefaults(health)

export const openTelemetryExporter = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['console', 'otlp', 'zipkin', 'memory', 'file'],
      default: 'console'
    },
    options: {
      type: 'object',
      description: 'Options for the exporter. These are passed directly to the exporter.',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to send the traces to. Not used for console or memory exporters.'
        },
        headers: {
          type: 'object',
          description: 'Headers to send to the exporter. Not used for console or memory exporters.'
        },
        path: {
          type: 'string',
          description: 'The path to write the traces to. Only for file exporter.'
        }
      }
    },
    additionalProperties: false
  }
}

export const telemetry = {
  type: 'object',
  properties: {
    enabled: {
      anyOf: [
        {
          type: 'boolean'
        },
        {
          type: 'string'
        }
      ]
    },
    applicationName: {
      type: 'string',
      description: 'The name of the application. Defaults to the folder name if not specified.'
    },
    version: {
      type: 'string',
      description: 'The version of the application (optional)'
    },
    skip: {
      type: 'array',
      description:
        'An array of paths to skip when creating spans. Useful for health checks and other endpoints that do not need to be traced.',
      items: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to skip. Can be a string or a regex.'
          },
          method: {
            description: 'HTTP method to skip',
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
          }
        }
      }
    },
    exporter: {
      anyOf: [
        {
          type: 'array',
          items: openTelemetryExporter
        },
        openTelemetryExporter
      ]
    }
  },
  required: ['applicationName'],
  additionalProperties: false
}

export const policies = {
  type: 'object',
  properties: {
    deny: {
      type: 'object',
      patternProperties: {
        '^.*$': {
          oneOf: [
            { type: 'string' },
            {
              type: 'array',
              items: {
                type: 'string'
              },
              minItems: 1
            }
          ]
        }
      }
    }
  },
  required: ['deny'],
  additionalProperties: false
}

export const compileCache = {
  anyOf: [
    { type: 'boolean' },
    {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Enable Node.js module compile cache for faster startup'
        },
        directory: {
          type: 'string',
          description: 'Directory to store compile cache. Defaults to .plt/compile-cache in app root'
        }
      },
      additionalProperties: false
    }
  ]
}

export const application = {
  type: 'object',
  anyOf: [{ required: ['id', 'path'] }, { required: ['id', 'url'] }],
  properties: {
    id: {
      type: 'string'
    },
    path: {
      type: 'string',
      // This is required for the resolve command to allow empty paths after environment variable replacement
      allowEmptyPaths: true,
      resolvePath: true
    },
    config: {
      type: 'string'
    },
    url: {
      type: 'string'
    },
    gitBranch: {
      type: 'string',
      default: 'main'
    },
    useHttp: {
      type: 'boolean'
    },
    reuseTcpPorts: {
      type: 'boolean',
      default: true
    },
    workers: {
      anyOf: [
        {
          type: 'number'
        },
        {
          type: 'string'
        },
        {
          type: 'object',
          properties: {
            static: { type: 'number', minimum: 1 },
            minimum: { type: 'number', minimum: 1 },
            maximum: { type: 'number', minimum: 0 },
            scaleUpELU: { type: 'number', minimum: 0, maximum: 1 },
            scaleDownELU: { type: 'number', minimum: 0, maximum: 1 }
          }
        }
      ]
    },
    health: { ...healthWithoutDefaults },
    dependencies: {
      type: 'array',
      items: {
        type: 'string'
      },
      default: []
    },
    arguments: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    env,
    envfile: {
      type: 'string'
    },
    sourceMaps: {
      type: 'boolean'
    },
    nodeModulesSourceMaps: {
      type: 'array',
      items: { type: 'string' }
    },
    packageManager: {
      type: 'string',
      enum: ['npm', 'pnpm', 'yarn']
    },
    preload,
    nodeOptions: {
      type: 'string'
    },
    execArgv: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    permissions: {
      type: 'object',
      properties: {
        fs: {
          type: 'object',
          properties: {
            read: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            write: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    },
    telemetry: {
      type: 'object',
      properties: {
        instrumentations: {
          type: 'array',
          description: 'An array of instrumentations loaded if telemetry is enabled',
          items: {
            oneOf: [
              {
                type: 'string'
              },
              {
                type: 'object',
                properties: {
                  package: {
                    type: 'string'
                  },
                  exportName: {
                    type: 'string'
                  },
                  options: {
                    type: 'object',
                    additionalProperties: true
                  }
                },
                required: ['package']
              }
            ]
          }
        }
      }
    },
    compileCache,
    management: {
      anyOf: [
        { type: 'boolean' },
        {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: true },
            operations: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          additionalProperties: false
        }
      ]
    }
  }
}

export const applications = {
  type: 'array',
  items: application
}

export const runtimeProperties = {
  $schema: {
    type: 'string'
  },
  preload,
  entrypoint: {
    type: 'string'
  },
  basePath: {
    type: 'string'
  },
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
          required: ['id'],
          properties: omitProperties(applications.items.properties, ['path', 'url', 'gitBranch'])
        }
      }
    }
  },
  applications,
  services: applications,
  web: applications,
  workers: { ...workers },
  workersRestartDelay: {
    anyOf: [
      {
        type: 'number',
        minimum: 0
      },
      { type: 'string' }
    ],
    default: 0
  },
  logger,
  server,
  reuseTcpPorts: {
    type: 'boolean',
    default: true
  },
  startTimeout: {
    default: 30000,
    type: 'number',
    minimum: 0
  },
  restartOnError: {
    default: true,
    anyOf: [
      { type: 'boolean' },
      {
        type: 'number',
        minimum: 0
      }
    ]
  },
  exitOnUnhandledErrors: {
    default: true,
    type: 'boolean'
  },
  gracefulShutdown: {
    type: 'object',
    properties: {
      runtime: {
        anyOf: [
          {
            type: 'number',
            minimum: 1
          },
          { type: 'string' }
        ],
        default: 10000
      },
      application: {
        anyOf: [
          {
            type: 'number',
            minimum: 1
          },
          { type: 'string' }
        ],
        default: 10000
      },
      closeConnections: {
        type: 'boolean',
        default: true,
        description: 'Add Connection: close header to HTTP responses during graceful shutdown'
      }
    },
    default: {},
    required: ['runtime', 'application'],
    additionalProperties: false
  },
  health,
  undici: {
    type: 'object',
    properties: {
      agentOptions: {
        type: 'object',
        additionalProperties: true
      },
      interceptors: {
        anyOf: [
          {
            type: 'array',
            items: undiciInterceptor
          },
          {
            type: 'object',
            properties: {
              Client: {
                type: 'array',
                items: undiciInterceptor
              },
              Pool: {
                type: 'array',
                items: undiciInterceptor
              },
              Agent: {
                type: 'array',
                items: undiciInterceptor
              }
            }
          }
        ]
      }
    }
  },
  httpCache: {
    oneOf: [
      {
        type: 'boolean'
      },
      {
        type: 'object',
        properties: {
          store: {
            type: 'string'
          },
          methods: {
            type: 'array',
            items: {
              type: 'string'
            },
            default: ['GET', 'HEAD'],
            minItems: 1
          },
          cacheTagsHeader: {
            type: 'string'
          },
          maxSize: {
            type: 'integer'
          },
          maxEntrySize: {
            type: 'integer'
          },
          maxCount: {
            type: 'integer'
          },
          origins: {
            type: 'array',
            items: {
              type: 'string'
            },
            description:
              'Whitelist of origins to cache. Supports exact strings and regex patterns (e.g., "/https:\\\\/\\\\/.*\\\\.example\\\\.com/").'
          },
          cacheByDefault: {
            type: 'integer',
            description: 'Default cache duration in seconds for responses without explicit expiration headers.'
          },
          type: {
            type: 'string',
            enum: ['shared', 'private'],
            default: 'shared',
            description: 'Cache type. "shared" caches may be shared between users, "private" caches are user-specific.'
          }
        }
      }
    ]
  },
  watch: {
    anyOf: [
      {
        type: 'boolean'
      },
      {
        type: 'string'
      }
    ]
  },
  managementApi: {
    anyOf: [
      { type: 'boolean' },
      { type: 'string' },
      {
        type: 'object',
        properties: {
          logs: {
            type: 'object',
            properties: {
              maxSize: {
                type: 'number',
                minimum: 5,
                default: 200
              }
            },
            additionalProperties: false
          },
          socket: {
            type: 'string',
            description:
              'Custom path for the control socket. If not specified, uses the default platform-specific location.'
          }
        },
        additionalProperties: false
      }
    ],
    default: true
  },
  metrics: {
    anyOf: [
      { type: 'boolean' },
      {
        type: 'object',
        properties: {
          port: {
            anyOf: [{ type: 'integer' }, { type: 'string' }]
          },
          enabled: {
            anyOf: [
              {
                type: 'boolean'
              },
              {
                type: 'string'
              }
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
          },
          labels: {
            type: 'object',
            additionalProperties: { type: 'string' }
          },
          applicationLabel: {
            type: 'string',
            default: 'applicationId',
            description:
              'The label name to use for the application identifier in metrics (e.g., applicationId, serviceId)'
          },
          readiness: {
            anyOf: [
              { type: 'boolean' },
              {
                type: 'object',
                properties: {
                  endpoint: { type: 'string' },
                  success: {
                    type: 'object',
                    properties: {
                      statusCode: { type: 'number' },
                      body: { type: 'string' }
                    },
                    additionalProperties: false
                  },
                  fail: {
                    type: 'object',
                    properties: {
                      statusCode: { type: 'number' },
                      body: { type: 'string' }
                    },
                    additionalProperties: false
                  }
                },
                additionalProperties: false
              }
            ]
          },
          liveness: {
            anyOf: [
              { type: 'boolean' },
              {
                type: 'object',
                properties: {
                  endpoint: { type: 'string' },
                  success: {
                    type: 'object',
                    properties: {
                      statusCode: { type: 'number' },
                      body: { type: 'string' }
                    },
                    additionalProperties: false
                  },
                  fail: {
                    type: 'object',
                    properties: {
                      statusCode: { type: 'number' },
                      body: { type: 'string' }
                    },
                    additionalProperties: false
                  }
                },
                additionalProperties: false
              }
            ]
          },
          healthChecksTimeouts: {
            anyOf: [{ type: 'integer' }, { type: 'string' }],
            default: 5000
          },
          plugins: {
            type: 'array',
            items: {
              anyOf: [
                {
                  type: 'string',
                  resolvePath: true
                }
              ]
            }
          },
          timeout: {
            anyOf: [{ type: 'integer' }, { type: 'string' }],
            default: 10000
          },
          otlpExporter: {
            type: 'object',
            description: 'Configuration for exporting metrics to an OTLP endpoint',
            properties: {
              enabled: {
                anyOf: [{ type: 'boolean' }, { type: 'string' }],
                description: 'Enable or disable OTLP metrics export'
              },
              endpoint: {
                type: 'string',
                description: 'OTLP endpoint URL (e.g., http://collector:4318/v1/metrics)'
              },
              interval: {
                anyOf: [{ type: 'integer' }, { type: 'string' }],
                default: 60000,
                description: 'Interval in milliseconds between metric pushes'
              },
              headers: {
                type: 'object',
                additionalProperties: { type: 'string' },
                description: 'Additional HTTP headers for authentication'
              },
              serviceName: {
                type: 'string',
                description: 'Service name for OTLP resource attributes'
              },
              serviceVersion: {
                type: 'string',
                description: 'Service version for OTLP resource attributes'
              }
            },
            required: ['endpoint'],
            additionalProperties: false
          },
          httpCustomLabels: {
            type: 'array',
            description:
              'Custom labels to add to HTTP metrics (http_request_all_duration_seconds). Each label extracts its value from an HTTP request header.',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'The label name to use in metrics'
                },
                header: {
                  type: 'string',
                  description: 'The HTTP request header to extract the value from'
                },
                default: {
                  type: 'string',
                  description: 'Default value when header is missing (defaults to "unknown")'
                }
              },
              required: ['name', 'header'],
              additionalProperties: false
            }
          }
        },
        additionalProperties: false
      }
    ]
  },
  telemetry,
  verticalScaler,
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
      watchDisabled: {
        type: 'boolean'
      }
    }
  },
  applicationTimeout: {
    anyOf: [
      {
        type: 'number',
        minimum: 1
      },
      { type: 'string' }
    ],
    default: 300000 // 5 minutes
  },
  startupConcurrency: {
    anyOf: [
      {
        type: 'number',
        minimum: 1
      },
      { type: 'string' }
    ]
  },
  messagingTimeout: {
    anyOf: [
      {
        type: 'number',
        minimum: 1
      },
      { type: 'string' }
    ],
    default: 30000 // 5 minutes
  },
  resolvedApplicationsBasePath: {
    type: 'string',
    default: 'external'
  },
  env,
  sourceMaps: {
    type: 'boolean',
    default: false
  },
  nodeModulesSourceMaps: {
    type: 'array',
    items: { type: 'string' },
    default: []
  },
  scheduler: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        enabled: {
          anyOf: [
            {
              type: 'boolean'
            },
            {
              type: 'string'
            }
          ],
          default: true
        },
        name: {
          type: 'string'
        },
        cron: {
          type: 'string'
        },
        callbackUrl: {
          type: 'string'
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          default: 'GET'
        },
        headers: {
          type: 'object',
          additionalProperties: {
            type: 'string'
          }
        },
        body: {
          anyOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }]
        },
        maxRetries: {
          type: 'number',
          minimum: 0,
          default: 3
        }
      },
      required: ['name', 'cron', 'callbackUrl']
    }
  },
  policies,
  compileCache
}

export const runtimeUnwrappablePropertiesList = [
  '$schema',
  'entrypoint',
  'applications',
  'application',
  'autoload',
  'applications',
  'web',
  'resolvedApplicationsBasePath'
]

export const applicationsUnwrappablePropertiesList = [
  'id',
  'path',
  'config',
  'url',
  'gitBranch',
  'dependencies',
  'useHttp',
  'management'
]

export const wrappedRuntimeProperties = omitProperties(runtimeProperties, runtimeUnwrappablePropertiesList)
export const wrappedApplicationProperties = omitProperties(
  application.properties,
  applicationsUnwrappablePropertiesList
)

wrappedRuntimeProperties.application = {
  type: 'object',
  properties: wrappedApplicationProperties,
  additionalProperties: false
}

export const wrappedRuntime = {
  type: 'object',
  properties: wrappedRuntimeProperties,
  additionalProperties: false
}

export const schemaComponents = {
  env,
  workers,
  preload,
  watch,
  cors,
  logger,
  server,
  fastifyServer,
  undiciInterceptor,
  health,
  healthWithoutDefaults,
  openTelemetryExporter,
  telemetry,
  policies,
  compileCache,
  applications,
  runtimeProperties,
  wrappedRuntimeProperties,
  wrappedRuntime
}
