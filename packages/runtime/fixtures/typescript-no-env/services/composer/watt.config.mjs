// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  server: {
    hostname: process.env.PLT_SERVER_HOSTNAME,
    port: Number(process.env.PORT ?? 0),
    logger: {
      level: process.env.PLT_SERVER_LOGGER_LEVEL
    }
  },
  gateway: {
    refreshTimeout: 1000,
    applications: [
      {
        id: 'movies',
        openapi: {
          url: '/documentation/json'
        }
      },
      {
        id: 'titles',
        openapi: {
          url: '/documentation/json'
        }
      }
    ]
  },
  watch: true
}
