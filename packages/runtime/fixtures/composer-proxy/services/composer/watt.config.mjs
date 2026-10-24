// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  server: {
    hostname: '127.0.0.1',
    port: 0,
    healthCheck: true
  },
  gateway: {
    applications: [
      {
        id: 'composer',
        origin: 'http://external-service/',
        proxy: {
          prefix: '/',
          upstream: 'http://localhost:3000/',
          ws: {
            upstream: 'ws://localhost:3000/graphql',
            reconnect: {
              logs: true
            },
            hooks: {
              path: './hooks.js'
            }
          }
        }
      }
    ]
  }
}
