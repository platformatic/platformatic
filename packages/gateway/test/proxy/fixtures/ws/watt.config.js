// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  watch: false,
  service: {
    proxy: {
      upstream: 'http://localhost:8080',
      prefix: '/ws',
      hostname: 'localhost',
      ws: {
        upstream: 'ws://localhost:8080',
        reconnect: {
          pingInterval: 1000,
          maxReconnectionRetries: 999,
          reconnectInterval: 1000,
          reconnectDecay: 1.1,
          connectionTimeout: 1000,
          reconnectOnClose: true,
          logs: true
        },
        hooks: {
          path: './hooks.js'
        }
      }
    }
  }
}
