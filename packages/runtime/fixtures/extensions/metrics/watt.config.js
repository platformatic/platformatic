// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  extensions: [
    '../extension-metrics-1.js'
  ],
  autoload: {
    path: '../services',
    exclude: [
      'crash-on-start'
    ]
  },
  logger: {
    level: 'error'
  },
  managementApi: true,
  metrics: {
    port: 0,
    labels: {
      env: 'test'
    }
  }
}
