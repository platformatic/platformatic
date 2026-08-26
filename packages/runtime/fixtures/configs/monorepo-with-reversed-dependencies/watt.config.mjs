// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: true,
  managementApi: true,
  gracefulShutdown: {
    runtime: 1000,
    service: 1000
  },
  applications: [
    {
      id: 'main',
      path: '../../monorepo-with-dependencies/main'
    },
    {
      id: 'service-1',
      path: '../../monorepo-with-dependencies/service-1'
    },
    {
      id: 'service-2',
      path: '../../monorepo-with-dependencies/service-2'
    }
  ]
}
