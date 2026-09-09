// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  server: {
    logger: {
      level: 'warn'
    }
  },
  plugins: {
    paths: [
      {
        path: 'plugin.js',
        encapsulate: false,
        options: {
          externalService: process.env.PLT_EXTERNAL_SERVICE
        }
      }
    ]
  }
}
