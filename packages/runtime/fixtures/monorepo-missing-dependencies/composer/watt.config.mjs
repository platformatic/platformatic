// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  gateway: {
    refreshTimeout: 5000,
    applications: [
      {
        id: 'missing',
        openapi: {
          url: '/documentation/json',
          prefix: '/missing'
        }
      }
    ]
  },
  watch: false
}
