// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  plugins: {
    paths: [
      'plugin.js'
    ]
  },
  gateway: {
    applications: [
      {
        id: 'service-2'
      }
    ]
  },
  watch: true,
  server: {
    hostname: '127.0.0.1',
    port: 0,
    logger: {
      level: 'silent'
    }
  }
}
