// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  autoload: {
    path: 'services'
  },
  managementApi: false,
  logger: {
    level: 'debug',
    pino: {
      level: 'severity',
      time: 'timestamp',
      message: 'message'
    }
  }
}
