// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: true,
  gracefulShutdown: {
    runtime: 1000,
    service: 1000
  },
  applications: [
    {
      id: 'service1',
      path: '../../monorepo-watch/service1'
    }
  ]
}
