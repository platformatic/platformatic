// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  gateway: {
    refreshTimeout: 1000,
    applications: [
      {
        id: 'node',
        proxy: {
          prefix: '/node'
        }
      }
    ]
  },
  watch: true,
  server: {
    hostname: '127.0.0.1',
    port: 3042
  }
}
