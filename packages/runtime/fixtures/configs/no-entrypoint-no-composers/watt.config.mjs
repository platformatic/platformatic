// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'error'
  },
  gracefulShutdown: {
    runtime: 1000,
    service: 1000
  },
  applications: [
    {
      id: 'main',
      path: '../../monorepo/serviceAppWithLogger'
    },
    {
      id: 'other',
      path: '../../monorepo/serviceAppWithLogger'
    }
  ]
}
