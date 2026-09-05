// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  autoload: {
    path: '../services'
  },
  metrics: {
    hostname: '127.0.0.1',
    port: 9090,
    liveness: {
      endpoint: '/live',
      success: {
        statusCode: 201,
        body: 'All right'
      },
      fail: {
        statusCode: 501,
        body: 'No good'
      }
    }
  }
}
