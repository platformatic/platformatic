// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  server: {
    hostname: '127.0.0.1',
    port: Number(process.env.PORT)
  },
  plugins: {
    paths: [
      '../../monorepo/serviceApp/plugin.js'
    ]
  }
}
