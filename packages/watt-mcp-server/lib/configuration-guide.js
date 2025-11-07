'use strict'

/**
 * Get comprehensive configuration guide for Watt/Platformatic
 * This provides Claude Code with complete knowledge to create and manipulate configurations
 */
export function getConfigurationGuide () {
  return {
    overview: `Platformatic Watt is a Node.js application server that allows you to run multiple Node.js applications centrally managed.

Key Features:
- Automatic multithreading with optimized resource allocation
- Comprehensive NFR management (logging, tracing, resource allocation)
- Integrated OpenTelemetry tracing for performance monitoring
- Unified logging with Pino across all applications
- Service mesh for inter-application communication

IMPORTANT: When creating HTTP services (Fastify, Express, etc.), always use type "node" by default.
Only use "service" type when you specifically need Platformatic's auto-generated features.`,

    typeSelectionGuide: {
      question: 'Which type should I use?',
      decision: {
        'Creating a Fastify HTTP service': 'Use "node" type (default)',
        'Creating an Express HTTP service': 'Use "node" type (default)',
        'Creating any HTTP server (Koa, raw HTTP, etc.)': 'Use "node" type (default)',
        'Need Platformatic auto-generated OpenAPI/REST APIs': 'Use "service" type',
        'Need auto-generated GraphQL/REST APIs from database': 'Use "db" type',
        'Need an API gateway to route to multiple services': 'Use "gateway" type',
        'Configuring multiple services/runtime': 'Use "runtime" type'
      },
      summary: 'Default to "node" for almost all HTTP services. Only use "service" for Platformatic-specific features.'
    },

    applicationTypes: {
      node: {
        description: 'Generic Node.js application (DEFAULT for HTTP services). Can run any Node.js HTTP server (Express, Fastify, Koa, raw HTTP, etc.). Use this by default for Fastify services, Express services, or any HTTP server.',
        requiredConfig: {
          node: {
            main: 'Path to the main entry file (e.g., "index.js" or "server.js")'
          }
        },
        optionalConfig: {
          server: 'Only needed if standalone (not behind gateway). Contains hostname and port.',
          logger: 'Logger configuration with level (trace, debug, info, warn, error, fatal)',
          metrics: 'Metrics configuration for monitoring',
          watch: 'Enable file watching for development (boolean)',
          telemetry: 'OpenTelemetry configuration for tracing',
          plugins: 'Fastify plugins configuration'
        },
        dependencies: ['wattpm', '@platformatic/node'],
        entryFileStructure: `'use strict'

export default async function (app, options) {
  // app is the Node.js HTTP server or framework instance
  // Configure your routes and middleware here
  app.get('/', async () => {
    return { message: 'Hello World' }
  })
}`,
        defaultApiImplementation: {
          description: 'When creating an API without specifying a library (no Fastify, Express, etc.), use node:http with create() function',
          example: `import { createServer } from 'node:http'

export function create() {
  return createServer((_, res) => {
    globalThis.platformatic.logger.debug('Serving request.')
    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' })
    res.end(JSON.stringify({ hello: 'world' }))
  })
}`,
          notes: 'The create() function returns a Node.js HTTP server. Platformatic provides globalThis.platformatic.logger for logging.'
        },
        fastifyApiImplementation: {
          description: 'When creating a Fastify API, use node type with create() function that returns a Fastify instance',
          example: `import Fastify from 'fastify'

export function create() {
  const app = Fastify()

  app.get('/', async () => {
    return { hello: 'world' }
  })

  app.post('/items', async (request) => {
    return { id: 1, ...request.body }
  })

  return app
}`,
          dependencies: ['wattpm', '@platformatic/node', 'fastify'],
          notes: 'The create() function returns a Fastify instance. Use @platformatic/node type (NOT @platformatic/service) for standard Fastify APIs. Add "fastify" to package.json dependencies.'
        }
      },
      service: {
        description: 'Platformatic Service - specialized Fastify service with auto-generated OpenAPI/REST APIs and database integration. Only use when you need Platformatic-specific features like auto-generated APIs. For regular Fastify servers, use "node" type instead.',
        requiredConfig: {
          service: {
            openapi: 'Boolean or object to enable OpenAPI support (usually true)'
          }
        },
        optionalConfig: {
          server: 'Only needed if standalone (not behind gateway). Contains hostname and port.',
          logger: 'Logger configuration',
          metrics: 'Metrics configuration',
          plugins: 'Path to plugins directory or configuration',
          watch: 'Enable file watching for development',
          telemetry: 'OpenTelemetry configuration',
          cors: 'CORS configuration',
          healthCheck: 'Health check endpoint configuration'
        },
        dependencies: ['wattpm', '@platformatic/service'],
        entryFileStructure: `'use strict'

export default async function (app, options) {
  // app is a Fastify instance
  // Register routes and plugins
  app.get('/', async () => {
    return { message: 'Hello from service' }
  })

  app.post('/items', async (request, reply) => {
    // Handle POST requests
    return { id: 1, ...request.body }
  })
}`,
        notes: 'Service automatically generates OpenAPI documentation and REST endpoints based on your routes'
      },
      db: {
        description: 'Database service with auto-generated GraphQL/REST APIs from SQL schema',
        requiredConfig: {
          db: {
            connectionString: 'Database connection string. Use {PLT_DATABASE_URL} env variable placeholder. Supports PostgreSQL, MySQL, MariaDB, SQLite.'
          }
        },
        optionalConfig: {
          server: 'Only needed if standalone (not behind gateway). Contains hostname and port.',
          logger: 'Logger configuration',
          metrics: 'Metrics configuration',
          migrations: 'Path to migrations directory (default: ./migrations)',
          'db.graphql': 'Enable GraphQL API (boolean or config object)',
          'db.openapi': 'Enable REST API (boolean or config object)',
          'db.schemalock': 'Enable schema locking to prevent unintended changes',
          watch: 'Enable file watching for development',
          telemetry: 'OpenTelemetry configuration'
        },
        dependencies: ['wattpm', '@platformatic/db'],
        migrationsStructure: `-- migrations/001.do.sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- migrations/001.undo.sql (optional)
DROP TABLE IF EXISTS users;`,
        notes: 'Platformatic DB automatically generates GraphQL and REST APIs based on your database schema. Migrations are applied in order.'
      },
      gateway: {
        description: 'API Gateway that routes requests to multiple services behind it',
        requiredConfig: {
          gateway: {
            services: 'Array of service references (usually auto-populated by runtime)'
          },
          server: {
            hostname: 'Server hostname (e.g., "0.0.0.0")',
            port: 'Server port (e.g., 3042)'
          }
        },
        optionalConfig: {
          logger: 'Logger configuration',
          metrics: 'Metrics configuration',
          telemetry: 'OpenTelemetry configuration',
          cors: 'CORS configuration',
          'gateway.graphql': 'GraphQL composition configuration',
          'gateway.openapi': 'OpenAPI composition configuration'
        },
        dependencies: ['wattpm', '@platformatic/gateway'],
        notes: 'Gateway ALWAYS needs server configuration. Services behind the gateway should NOT have server config. The gateway handles all routing to services via the service mesh.'
      }
    },

    runtimeConfiguration: {
      description: 'The root watt.json configures the entire application runtime with multiple services',
      structure: {
        $schema: 'URL to the runtime JSON schema (https://schemas.platformatic.dev/@platformatic/runtime/3.json)',
        autoload: 'Object for monorepo auto-discovery of services (RECOMMENDED). Contains path and optional exclude array.',
        applications: 'Array of application/service objects (use when not using autoload)',
        entrypoint: 'REQUIRED: Which service ID is the main entrypoint (publicly exposed). This service handles all incoming HTTP requests.',
        watch: 'Enable file watching for hot reload in development (boolean)',
        logger: 'Global logger configuration (can be overridden per-app)',
        server: 'Server configuration for the entrypoint',
        env: 'Global environment variables for all applications',
        telemetry: 'OpenTelemetry configuration',
        metrics: 'Prometheus metrics server configuration',
        workers: 'Default number of workers per application',
        gracefulShutdown: 'Graceful shutdown timeout configuration',
        restartOnError: 'Restart failed applications configuration',
        startTimeout: 'Application startup timeout (default: 30000ms)',
        basePath: 'Base path for deployment under subpath (e.g., /api)'
      },
      webArrayItem: {
        id: 'Unique identifier for the service (required)',
        path: 'Path to the service directory (e.g., "./web/frontend")',
        config: 'Path to service config file (e.g., "./web/frontend/watt.json")',
        entrypoint: 'Boolean - true if this is the main entrypoint',
        useHttp: 'Start on random HTTP port (needed for @fastify/express)',
        workers: 'Number of workers for this application',
        dependencies: 'Array of application IDs that must start first',
        env: 'Application-specific environment variables',
        arguments: 'Command line arguments for the application'
      },
      exampleWithAutoload: `{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/3.11.0.json",
  "autoload": {
    "path": "./services",
    "exclude": ["common", "shared"]
  },
  "entrypoint": "gateway",
  "server": {
    "hostname": "0.0.0.0",
    "port": 3042
  },
  "logger": {
    "level": "info"
  }
}`,
      exampleWithApplications: `{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/3.11.0.json",
  "applications": [
    {
      "id": "gateway",
      "path": "./services/gateway",
      "config": "./services/gateway/watt.json"
    },
    {
      "id": "api",
      "path": "./services/api",
      "config": "./services/api/watt.json"
    },
    {
      "id": "auth",
      "path": "./services/auth",
      "config": "./services/auth/watt.json"
    }
  ],
  "entrypoint": "gateway",
  "server": {
    "hostname": "0.0.0.0",
    "port": 3042
  },
  "logger": {
    "level": "info"
  }
}`
    },

    architecturePatterns: {
      standaloneService: {
        description: 'A single service that runs independently',
        structure: 'Single watt.json with server config (hostname + port)',
        useCase: 'Simple APIs, microservices that run alone, development/testing',
        example: {
          config: {
            service: { openapi: true },
            server: { hostname: '0.0.0.0', port: 3000 },
            logger: { level: 'info' }
          }
        }
      },
      gatewayWithServices: {
        description: 'Multiple services behind a gateway (RECOMMENDED)',
        structure: 'Runtime watt.json with autoload (recommended) or applications array + gateway with server config + services without server config',
        useCase: 'Microservices architecture, API composition, production deployments',
        routing: 'Gateway automatically routes to services via service mesh. Services communicate using http://serviceId/ URLs',
        exampleWithAutoload: {
          runtime: {
            autoload: { path: './services', exclude: ['common'] },
            entrypoint: 'gateway',
            server: { port: 3000 }
          },
          gateway: { gateway: { services: [] }, server: { port: 3000 } },
          service: { service: { openapi: true } }
        },
        exampleWithApplications: {
          runtime: {
            applications: [
              { id: 'gateway', path: './services/gateway' },
              { id: 'users-api', path: './services/users-api' },
              { id: 'products-api', path: './services/products-api' }
            ],
            entrypoint: 'gateway',
            server: { port: 3000 }
          },
          gateway: { gateway: { services: [] }, server: { port: 3000 } },
          service: { service: { openapi: true } }
        },
        notes: 'Gateway config gets server, individual services do NOT get server config. Use autoload for monorepo pattern.'
      },
      multiServiceWithoutGateway: {
        description: 'Multiple services each with their own ports',
        structure: 'Runtime watt.json + each service has server config with different ports',
        useCase: 'Independent services that need different ports, migration scenarios',
        notes: 'Each service must have unique port. Less common pattern, usually gateway is preferred.'
      }
    },

    commonPatterns: {
      environmentVariables: {
        description: 'Use placeholders like {PLT_DATABASE_URL} in config files',
        syntax: '{VARIABLE_NAME}',
        example: 'connectionString: "{PLT_DATABASE_URL}"',
        notes: 'Watt automatically replaces placeholders with environment variables. Load from .env file or command line.',
        specialPlaceholders: {
          PLT_ROOT: 'Automatically set to directory containing config file. Use for relative paths.'
        }
      },
      serviceMesh: {
        description: 'Services in the same runtime can call each other via service mesh',
        syntax: 'http://serviceId/path',
        example: 'http://api/users (where "api" is the service id)',
        notes: 'No need for localhost:port when services are in same runtime. Mesh provides automatic service discovery and load balancing.',
        internalCommunication: 'All inter-service communication goes through the mesh for observability and control'
      },
      logger: {
        levels: ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'],
        example: { level: 'info' },
        development: 'Use "debug" or "trace" for development',
        production: 'Use "warn" or "error" in production for performance',
        transport: 'Can configure custom transports for log aggregation (e.g., pino-elasticsearch)',
        structured: 'Pino provides structured JSON logging for easy parsing'
      },
      metrics: {
        description: 'Enable Prometheus-compatible metrics for monitoring',
        example: {
          server: 'hide',
          defaultMetrics: { enabled: true }
        },
        notes: 'Metrics are aggregated across all workers. Access at /metrics endpoint by default.',
        prometheusServer: {
          enabled: true,
          hostname: '0.0.0.0',
          port: 9090,
          endpoint: '/metrics'
        }
      },
      telemetry: {
        description: 'OpenTelemetry for distributed tracing',
        exporters: ['console', 'otlp', 'zipkin', 'memory'],
        example: {
          applicationName: 'my-app',
          exporter: {
            type: 'otlp',
            options: { url: 'http://localhost:4318/v1/traces' }
          }
        },
        notes: 'Can send traces to Jaeger, Zipkin, or any OTLP-compatible backend'
      },
      hotReload: {
        description: 'File watching for development',
        config: { watch: true },
        notes: 'Enable watch at runtime level and application level. Not recommended for production.',
        scope: 'Watches for file changes and automatically restarts affected services'
      },
      workers: {
        description: 'Automatic multithreading for performance',
        config: { workers: 4 },
        notes: 'Number of worker threads per application. Defaults to 1. Automatically load-balanced.',
        considerations: 'Entrypoint is always 1 worker. More workers = more memory but better throughput.'
      }
    },

    packageJsonRequirements: {
      type: 'Must be "module" for ES modules (required)',
      scripts: {
        start: 'Should be "watt start" (not "platformatic start")',
        dev: 'Can be "watt start" for development'
      },
      dependencies: 'Must include wattpm and appropriate @platformatic/* packages based on service types',
      workspaces: 'In multi-service projects, each service should have unique name to avoid npm workspace conflicts',
      versions: 'Use consistent versions across all @platformatic/* packages',
      example: {
        name: 'my-service',
        version: '1.0.0',
        type: 'module',
        scripts: {
          start: 'watt start',
          dev: 'watt start'
        },
        dependencies: {
          wattpm: '^3.11.0',
          '@platformatic/service': '^3.11.0'
        }
      }
    },

    bestPractices: [
      'IMPORTANT: Use "node" type for HTTP services (Fastify, Express, Koa, etc.) - this is the default and most flexible option',
      'When creating an API without specifying a library, use node:http with a create() function that returns createServer()',
      'When creating a Fastify API, use node type with a create() function that returns a Fastify instance, and add "fastify" to dependencies',
      'Only use "service" type when you need Platformatic-specific features like auto-generated OpenAPI or database integration',
      'Only use "db" type when you need auto-generated GraphQL/REST APIs from a database schema',
      'Use "gateway" type only for API gateway that routes to multiple services',
      'Runtime configurations MUST specify an entrypoint - the service ID that handles incoming HTTP requests',
      'If there is a gateway in the runtime, the gateway MUST be set as the entrypoint',
      'Services behind a gateway should NOT have server configuration - the gateway handles all HTTP',
      'Gateways ALWAYS need server configuration with hostname and port',
      'Use environment variables with {PLACEHOLDER} syntax for sensitive data (database URLs, API keys)',
      'Each service in a workspace needs a unique package.json name to avoid npm conflicts',
      'Use autoload for monorepo pattern - it auto-discovers services from a directory',
      'When using autoload, the entrypoint must match one of the auto-discovered service IDs (directory names)',
      'Use migrations for database schema changes, not direct SQL. Keep migrations small and atomic.',
      'Use logger level "info" for development, "warn" or "error" for production',
      'Enable telemetry in production for observability and debugging distributed issues',
      'Use the service mesh (http://serviceId/) for inter-service communication, not localhost',
      'Set appropriate startTimeout if services take long to initialize (default 30s)',
      'Configure gracefulShutdown timeouts to allow clean shutdowns',
      'Use workers for CPU-bound workloads, but be aware of memory overhead',
      'Always use package.json type: "module" for ES modules support',
      'Keep configuration files in JSON for tooling support, or YAML for readability',
      'Use the PLT_ROOT placeholder for relative paths in configuration'
    ],

    troubleshooting: {
      'Service not starting': 'Check if dependencies are installed (npm install), watt.json is valid (validate), and logs for errors. Check startTimeout if service takes long to initialize.',
      'Port already in use': 'Change port in server config or ensure no conflicts. Check if another instance is running. Use different ports for each standalone service.',
      'Services cannot connect': 'Use service ID as hostname (e.g., http://api not localhost). Ensure services are in same runtime. Check service mesh is working.',
      'Database connection fails': 'Verify PLT_DATABASE_URL environment variable is set correctly. Check database is running and accessible. Verify connection string format.',
      'Missing dependencies': 'Run npm install and ensure package.json has correct @platformatic/* packages with matching versions.',
      'Hot reload not working': 'Enable watch:true at both runtime and application level. Check file permissions. Not supported in production.',
      'Worker crashes': 'Check logs for errors. Verify memory limits. Consider reducing workers if memory-constrained. Check for memory leaks.',
      'Metrics not appearing': 'Ensure metrics config is enabled. Check Prometheus server port is accessible. Verify no port conflicts on 9090.',
      'Telemetry not working': 'Verify exporter URL is accessible. Check telemetry config. Ensure applicationName is set. Test with console exporter first.',
      'Gateway not routing': 'Verify services array in gateway config. Check service IDs match. Ensure services are started. Check gateway logs.',
      'CORS issues': 'Configure CORS in gateway or service config. Use cors: true for development, specific origins for production.',
      'OpenAPI not generating': 'Ensure openapi: true in service config. Check routes are properly registered. Verify Fastify decorators.',
      'Environment variables not loading': 'Check .env file location (same directory as config or cwd). Verify placeholder syntax {VAR_NAME}. Check file permissions.',
      'Startup timeout': 'Increase startTimeout in runtime config (default 30000ms). Check what is delaying service startup. Consider async initialization issues.'
    },

    advancedFeatures: {
      autoload: {
        description: 'Automatically discover and load services from a directory (monorepo pattern)',
        example: {
          autoload: {
            path: './packages',
            exclude: ['shared', 'common']
          }
        },
        notes: 'Useful for monorepos. Each subdirectory becomes a service.'
      },
      verticalScaling: {
        description: 'Automatic worker scaling based on Event Loop Utilization and memory',
        config: {
          verticalScaler: {
            enabled: true,
            maxTotalWorkers: 8,
            scaleUpELU: 0.8,
            scaleDownELU: 0.2
          }
        },
        notes: 'Dynamically adjusts workers based on load. Reactive and periodic modes.'
      },
      httpCache: {
        description: 'HTTP caching layer for improved performance',
        config: {
          httpCache: {
            store: 'memory',
            methods: ['GET', 'HEAD'],
            maxSize: 10485760
          }
        }
      },
      scheduler: {
        description: 'Cron-based HTTP call scheduling',
        example: {
          scheduler: [
            {
              name: 'cleanup',
              cron: '0 2 * * *',
              callbackUrl: 'http://api/cleanup',
              method: 'POST'
            }
          ]
        }
      },
      permissions: {
        description: 'File system access restrictions per application',
        example: {
          permissions: {
            fs: {
              read: ['./data'],
              write: ['./tmp']
            }
          }
        },
        notes: 'Based on Node.js permission model. Restricts native modules, child processes.'
      }
    }
  }
}
