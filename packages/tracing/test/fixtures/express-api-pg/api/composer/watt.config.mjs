// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  server: {
    healthCheck: true,
    hostname: '127.0.0.1',
    port: 3042
  },
  gateway: {
    refreshTimeout: 10000,
    applications: [
      {
        id: 'express',
        proxy: {
          prefix: '/express'
        }
      }
    ]
  },
  watch: true
}
