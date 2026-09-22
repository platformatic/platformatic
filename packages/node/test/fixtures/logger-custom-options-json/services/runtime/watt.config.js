// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/node',
  logger: {
    level: 'debug',
    formatters: {
      path: 'logger-formatters.js'
    },
    timestamp: 'isoTime',
    redact: {
      paths: [
        'secret'
      ],
      censor: '***HIDDEN***'
    }
  }
}
