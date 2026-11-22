// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  extensions: '../extension-health-duplicate-route.js',
  autoload: {
    path: '../services',
    exclude: [
      'crash-on-start'
    ]
  },
  metrics: {
    hostname: '127.0.0.1',
    port: 0
  },
  logger: {
    level: 'error'
  }
}
