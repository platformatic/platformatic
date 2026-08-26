// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  service: {
    openapi: true
  },
  watch: true,
  plugins: {
    paths: [
      '../worker-scaler-service/routes'
    ]
  },
  runtime: {
    verticalScaler: {
      enabled: true,
      maxWorkers: 2,
      maxTotalWorkers: 10
    }
  },
  server: {
    hostname: '127.0.0.1',
    port: 0
  }
}
