// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: true,
  restartOnError: 500,
  autoload: {
    path: '.'
  },
  logger: {
    level: 'error'
  },
  health: {
    enabled: true,
    interval: 1000,
    maxELU: 0.95,
    maxHeapUsed: 0.95,
    maxHeapTotal: '512MB'
  }
}
