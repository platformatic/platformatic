// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  server: {
    logger: {
      level: 'warn'
    },
    hostname: '127.0.0.1',
    port: 0
  },
  plugins: {
    paths: [
      {
        path: 'dist/plugin.js',
        encapsulate: false
      }
    ]
  }
}
