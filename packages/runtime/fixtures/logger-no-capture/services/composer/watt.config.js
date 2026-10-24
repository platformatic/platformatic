// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  gateway: {
    applications: [
      {
        id: 'node',
        proxy: {
          prefix: '/node'
        }
      },
      {
        id: 'service',
        proxy: {
          prefix: '/service'
        }
      }
    ]
  },
  server: {
    hostname: '127.0.0.1',
    port: 0
  }
}
