// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: false,
  metrics: false,
  management: true,
  logger: {
    level: 'warn'
  },
  applications: [
    {
      id: 'app1',
      path: 'app1'
    },
    {
      id: 'app2',
      path: 'app2',
      management: false
    }
  ]
}
