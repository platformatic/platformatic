// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/vite',
  vite: {
    ssr: true
  },
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
  }
}
