// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  gateway: {
    applications: [
      {
        id: 'service-1',
        proxy: {
          prefix: '/service-1'
        }
      },
      {
        id: 'service-2',
        proxy: {
          prefix: '/service-2'
        }
      },
      {
        id: 'service-node',
        proxy: {
          prefix: '/service-node'
        }
      }
    ]
  },
  server: {
    hostname: '127.0.0.1',
    port: 0
  }
}
