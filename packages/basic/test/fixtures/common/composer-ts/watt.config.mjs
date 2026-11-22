// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  gateway: {
    applications: [
      {
        id: 'backend',
        openapi: {
          url: '/documentation/json',
          prefix: '/backend'
        }
      },
      {
        id: 'frontend'
      }
    ]
  },
  watch: false,
  plugins: {
    paths: [
      {
        path: './plugins',
        encapsulate: false
      },
      './routes'
    ]
  }
}
