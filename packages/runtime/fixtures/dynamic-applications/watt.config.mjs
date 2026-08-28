// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: true,
  metrics: {
    port: 0
  },
  restartOnError: 500,
  autoload: {
    path: '.',
    exclude: [
      'application-2'
    ]
  },
  logger: {
    level: 'debug'
  },
  workers: {
    dynamic: true,
    minimum: 1,
    maximum: 2,
    total: 10,
    scaleUpELU: 0.1,
    scaleDownELU: 0.2,
    gracePeriod: 5000,
    cooldown: 5000
  }
}
