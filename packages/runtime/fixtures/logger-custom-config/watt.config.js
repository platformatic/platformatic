// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  autoload: {
    path: 'services'
  },
  logger: {
    captureStdio: false,
    level: 'info',
    customLevels: {
      verbose: 10
    },
    base: null,
    messageKey: 'message',
    timestamp: 'isoTime',
    formatters: {
      path: 'logger-formatters.js'
    }
  }
}
