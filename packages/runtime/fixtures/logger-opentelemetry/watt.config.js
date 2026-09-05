// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  autoload: {
    path: 'services'
  },
  watch: false,
  logger: {
    level: 'debug',
    base: null,
    openTelemetryExporter: {
      protocol: 'http',
      url: 'http://localhost:4318/v1/logs'
    }
  },
  tracing: {
    enabled: true,
    applicationName: 'logger-opentelemetry',
    version: '1.0.0'
  }
}
