// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  extensions: [
    '../extension-metrics-1.js',
    '../extension-metrics-2.js'
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
