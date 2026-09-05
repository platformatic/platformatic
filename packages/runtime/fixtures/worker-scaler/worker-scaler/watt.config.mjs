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
  workers: {
    dynamic: true,
    minimum: 1,
    maximum: 10,
    total: 10,
    gracePeriod: 1000
  }
}
