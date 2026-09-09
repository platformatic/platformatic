// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  autoload: {
    path: 'services'
  },
  watch: false,
  managementApi: true,
  logger: {
    captureStdio: false,
    level: 'debug',
    formatters: {
      path: 'logger-formatters.js'
    }
  }
}
