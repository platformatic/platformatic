// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/next',
  application: {
    basePath: '/next'
  },
  logger: {
    level: 'trace',
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
  },
  cache: {
    adapter: 'valkey',
    url: 'valkey://localhost:6379',
    prefix: 'plt:test:logger-web'
  },
  server: {
    port: 0
  }
}
