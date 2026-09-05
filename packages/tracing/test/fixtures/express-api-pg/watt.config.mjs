// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'info'
  },
  autoload: {
    path: 'api'
  },
  basePath: '/',
  tracing: {
    applicationName: 'test-pg',
    version: '1.0.0',
    exporter: {
      type: 'file'
    }
  },
  applications: [
    {
      id: 'express',
      path: './api/express',
      tracing: {
        instrumentations: [
          '@opentelemetry/instrumentation-pg'
        ]
      }
    }
  ]
}
