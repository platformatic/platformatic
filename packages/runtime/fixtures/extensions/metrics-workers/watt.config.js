// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  extensions: [
    '../extension-metrics-1.js'
  ],
  applications: [
    {
      id: 'a',
      path: '../services/a'
    },
    {
      id: 'b',
      path: '../metrics-services/b',
      workers: 3
    }
  ],
  logger: {
    level: 'error'
  },
  metrics: {
    port: 0
  }
}
