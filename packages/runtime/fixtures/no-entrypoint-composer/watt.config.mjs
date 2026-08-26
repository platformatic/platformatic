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
        id: 'main'
      }
    ]
  },
  watch: false
}
