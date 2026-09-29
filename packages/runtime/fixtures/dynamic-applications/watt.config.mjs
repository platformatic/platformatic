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
    eluThreshold: 0.1,
    processIntervalMs: 3000,
    cooldowns: { scaleUpAfterScaleUpMs: 5000, scaleDownAfterScaleDownMs: 5000 }
  }
}
