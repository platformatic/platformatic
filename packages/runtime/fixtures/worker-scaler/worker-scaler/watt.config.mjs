// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: true,
  autoload: {
    path: '../services',
    exclude: [
      'docs'
    ]
  },
  logger: {
    level: 'info'
  },
  health: {
    enabled: false
  },
  verticalScaler: {
    enabled: true,
    gracePeriod: 1000,
    maxTotalWorkers: 10
  }
}
