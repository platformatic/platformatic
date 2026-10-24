// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  server: {
    hostname: '127.0.0.1',
    port: 0,
    logger: {
      level: 'info'
    },
    pluginTimeout: 0
  },
  gateway: {
    applications: [
      {
        id: 'service-1',
        openapi: {
          url: '/documentation/json',
          prefix: '/service-1'
        }
      },
      {
        id: 'external-service-1',
        origin: 'http://external-dependency-1',
        openapi: {
          file: './external-service.schema.json',
          prefix: '/external-service-1'
        }
      }
    ]
  },
  watch: false
}
