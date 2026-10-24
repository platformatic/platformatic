// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  autoload: {
    path: './services'
  },
  metrics: {
    hostname: '127.0.0.1',
    port: 9090,
    readiness: {
      endpoint: '/readiness',
      success: {
        statusCode: 202,
        body: 'All ready'
      },
      fail: {
        statusCode: 502,
        body: 'Not ready'
      }
    }
  }
}
