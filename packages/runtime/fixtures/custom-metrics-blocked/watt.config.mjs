// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: true,
  metrics: {
    enabled: true,
    timeout: 1000
  },
  restartOnError: 500,
  autoload: {
    path: '.'
  },
  logger: {
    level: 'error'
  },
  gracefulShutdown: {
    runtime: 10000,
    application: 1000
  }
}
