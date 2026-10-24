// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  gateway: {
    refreshTimeout: 0,
    applications: [
      {
        id: 'service',
        proxy: {
          prefix: '/service'
        },
        openapi: {
          url: '/documentation/json',
          prefix: '/service-openapi'
        }
      }
    ]
  },
  server: {
    hostname: '127.0.0.1',
    port: 0
  }
}
