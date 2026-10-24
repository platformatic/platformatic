// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/react-router',
  logger: {
    level: 'debug',
    formatters: {
      path: 'logger-formatters.js'
    },
    timestamp: 'isoTime',
    redact: {
      paths: [
        'req.host'
      ],
      censor: '***HIDDEN***'
    }
  },
  server: {
    port: 0
  }
}
