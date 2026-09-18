// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  server: {
    hostname: '127.0.0.1',
    port: 0,
    logger: {
      level: 'fatal'
    }
  },
  gateway: {
    refreshTimeout: 1000,
    applications: [
      {
        id: 'api1',
        origin: 'http://127.0.0.1',
        openapi: {
          file: './api1.json'
        }
      }
    ]
  },
  watch: false
}
