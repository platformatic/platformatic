// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  service: {
    openapi: true
  },
  plugins: {
    paths: [
      'plugin.js'
    ]
  },
  watch: true,
  server: {
    hostname: '127.0.0.1',
    port: 0,
    logger: {
      level: 'error'
    }
  }
}
