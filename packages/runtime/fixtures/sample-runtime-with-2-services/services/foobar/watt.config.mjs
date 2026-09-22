// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  service: {
    openapi: true
  },
  watch: true,
  plugins: {
    paths: [
      {
        path: './plugins',
        encapsulate: false
      },
      './routes'
    ],
    packages: []
  }
}
