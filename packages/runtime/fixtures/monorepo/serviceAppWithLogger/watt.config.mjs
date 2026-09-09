// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  server: {
    hostname: '127.0.0.1',
    port: 0,
    logger: {
      name: 'service-with-logger',
      level: 'info'
    }
  },
  service: {
    openapi: true
  },
  plugins: {
    paths: [
      'plugin.js'
    ]
  },
  watch: true
}
