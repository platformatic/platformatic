// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  extensions: [
    '../extension-metrics-process-collision.js'
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
  metrics: {
    port: 0
  }
}
