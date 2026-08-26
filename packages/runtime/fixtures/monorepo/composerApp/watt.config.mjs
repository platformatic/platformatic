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
    refreshTimeout: 5000,
    applications: [
      {
        id: 'with-logger',
        openapi: {
          url: '/documentation/json',
          prefix: '/with-logger'
        },
        proxy: {
          prefix: '/proxy/with-logger'
        }
      },
      {
        id: 'multi-plugin-service',
        openapi: {
          url: '/documentation/json',
          prefix: '/multi-plugin-service'
        }
      },
      {
        id: 'serviceApp',
        openapi: {
          url: '/documentation/json',
          prefix: '/service-app'
        },
        proxy: {
          prefix: '/proxy/service-app'
        }
      },
      {
        id: 'external-service',
        origin: 'https://external-service.com',
        openapi: {
          file: './external-service.json',
          prefix: '/external-service'
        }
      }
    ]
  },
  watch: false
}
