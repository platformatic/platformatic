// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  server: {
    hostname: '127.0.0.1',
    port: 0
  },
  service: {
    openapi: true
  },
  plugins: {
    paths: [
      {
        path: 'plugin.js',
        options: {
          name: 'plugin1'
        }
      },
      {
        path: 'plugin2.mjs',
        options: {
          name: 'plugin2'
        }
      }
    ]
  },
  watch: true
}
