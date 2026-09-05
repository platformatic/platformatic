// See the sibling worker-scaler-service: same shape, with the minimum stated rather than defaulted.
export default {
  workers: {
    dynamic: true,
    minimum: 1,
    maximum: 2,
    total: 10
  },
  application: {
    config: {
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
      server: {
        hostname: '127.0.0.1',
        port: 0
      }
    }
  }
}
