// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  restartOnError: false,
  metrics: {
    hostname: '127.0.0.1',
    port: 0,
    aggregateWorkers: true
  },
  applications: [
    {
      id: 'main',
      path: './main'
    },
    {
      id: 'node',
      path: './node',
      workers: 3
    }
  ],
  logger: {
    level: 'error'
  }
}
