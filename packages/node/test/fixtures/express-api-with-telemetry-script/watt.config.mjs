// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'error'
  },
  telemetry: {
    applicationName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  },
  applications: [
    {
      id: 'api',
      path: './services/api'
    }
  ]
}
