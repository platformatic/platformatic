// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  server: {
    logger: {
      level: 'debug',
      formatters: {
        path: 'logger-formatters.js'
      }
    }
  },
  plugins: {
    paths: [
      './routes'
    ]
  }
}
