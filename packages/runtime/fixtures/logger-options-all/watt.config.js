// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  autoload: {
    path: 'services'
  },
  watch: false,
  managementApi: false,
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
