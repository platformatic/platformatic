// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  server: {
    hostname: '127.0.0.1',
    port: 0
  },
  service: {
    openapi: true
  },
  plugins: {
    paths: [
      'plugin.js'
    ]
  },
  clients: [
    {
      serviceId: 'with-logger',
      path: './with-logger',
      url: process.env.PLT_WITH_LOGGER_URL
    }
  ],
  watch: {
    enabled: true
  }
}
