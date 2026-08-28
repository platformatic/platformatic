// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  server: {
    logger: {
      level: 'info'
    },
    hostname: '127.0.0.1',
    port: 0,
    pluginTimeout: 60000,
    keepAliveTimeout: 1
  },
  plugins: {
    paths: [
      'plugin.ts'
    ]
  },
  watch: false
}
