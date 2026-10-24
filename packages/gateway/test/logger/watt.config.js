// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  server: {
    hostname: '127.0.0.1',
    port: 0,
    logger: {
      level: 'debug',
      transport: {
        target: 'pino/file',
        options: {
          destination: `${process.env.LOG_DIR}/application.log`,
          mkdir: true
        }
      },
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
  },
  gateway: {
    applications: []
  }
}
