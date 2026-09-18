// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: true,
  metrics: true,
  restartOnError: 250,
  startTimeout: 1000,
  logger: {
    level: 'trace'
  },
  applications: [
    {
      id: 'node',
      path: './node',
      workers: 3,
      health: {
        maxHeapTotal: 1073741824
      }
    },
    {
      id: 'service',
      path: './service',
      workers: 4,
      health: {
        maxHeapTotal: 1073741824
      }
    },
    {
      id: 'composer',
      path: './composer'
    }
  ]
}
