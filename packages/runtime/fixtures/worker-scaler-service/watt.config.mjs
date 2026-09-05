// v3 put the scaler settings under this application's own `runtime` block, which the wrap hoisted
// to the root. v4 has no hoisting and no `runtime` block: `workers` is top-level, beside the
// singular `application` entry whose `config` is what the bare capability export would be.
export default {
  workers: {
    dynamic: true,
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
          './routes'
        ]
      },
      server: {
        hostname: '127.0.0.1',
        port: 0
      }
    }
  }
}
