// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  autoload: {
    path: '../services'
  },
  logger: {
    level: 'error'
  },
  restartOnError: 1000,
  health: {
    enabled: true,
    interval: 1000,
    gracePeriod: 1
  }
}
