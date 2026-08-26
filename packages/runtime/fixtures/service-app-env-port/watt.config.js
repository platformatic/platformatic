// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  server: {
    hostname: '127.0.0.1',
    port: Number(process.env.PORT)
  },
  service: {
    openapi: true
  },
  plugins: {
    paths: [
      '../monorepo/serviceApp/plugin.js'
    ]
  },
  clients: [
    {
      serviceId: 'with-logger',
      path: '../monorepo/serviceApp/with-logger',
      url: process.env.PLT_WITH_LOGGER_URL
    }
  ],
  watch: {
    enabled: true
  }
}
