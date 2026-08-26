// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  server: {
    hostname: process.env.PLT_SERVER_HOSTNAME,
    port: Number(process.env.PORT),
    logger: {
      level: process.env.PLT_SERVER_LOGGER_LEVEL
    }
  },
  gateway: {
    applications: [
      {
        id: 'deeply-splitte',
        openapi: {
          url: '/documentation/json'
        }
      }
    ]
  },
  watch: false
}
