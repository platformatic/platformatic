// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  managementApi: {},
  logger: {
    level: 'trace'
  },
  gracefulShutdown: {
    runtime: 1000,
    service: 1000
  },
  watch: false,
  applications: [
    {
      id: 'stdio',
      path: '../../stdio'
    }
  ]
}
