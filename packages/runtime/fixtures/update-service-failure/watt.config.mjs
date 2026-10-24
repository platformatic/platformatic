// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  restartOnError: 100,
  logger: {
    level: 'trace'
  },
  applications: [
    {
      id: 'node',
      path: './node',
      workers: 1,
      health: {
        maxHeapTotal: '256 MB'
      }
    }
  ]
}
