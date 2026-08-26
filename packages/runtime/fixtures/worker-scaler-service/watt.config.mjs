// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  service: {
    openapi: true
  },
  watch: true,
  plugins: {
    paths: [
      './routes'
    ]
  },
  runtime: {
    workers: {
      dynamic: true,
      maximum: 2,
      total: 10
    }
  },
  server: {
    hostname: '127.0.0.1',
    port: 0
  }
}
