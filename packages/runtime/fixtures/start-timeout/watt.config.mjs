// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: true,
  metrics: false,
  startTimeout: 500,
  restartOnError: 500,
  logger: {
    level: 'trace'
  },
  applications: [
    {
      id: 'node',
      path: './node'
    }
  ]
}
