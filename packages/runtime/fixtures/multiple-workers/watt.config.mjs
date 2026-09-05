// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: true,
  metrics: {
    port: 0
  },
  restartOnError: 500,
  autoload: {
    path: '.'
  },
  logger: {
    level: 'trace'
  },
  workers: 3,
  applications: [
    {
      id: 'node',
      path: './node',
      workers: 5
    }
  ]
}
