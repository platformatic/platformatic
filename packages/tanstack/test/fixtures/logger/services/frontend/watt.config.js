// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/tanstack',
  logger: {
    level: 'debug',
    formatters: {
      path: 'logger-formatters.js'
    },
    timestamp: 'isoTime',
    redact: {
      paths: [
        'req.headers.authorization'
      ],
      censor: '***HIDDEN***'
    }
  },
  server: {
    port: 0
  }
}
