// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'error'
  },
  tracing: {
    applicationName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'file'
    }
  },
  applications: [
    {
      id: 'api',
      path: './services/api',
      tracing: {
        instrumentations: [
          '@opentelemetry/instrumentation-express'
        ]
      }
    }
  ]
}
