// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'error'
  },
  gracefulShutdown: {
    runtime: 1000,
    application: 1000
  },
  applications: [
    {
      id: 'main',
      path: '../../monorepo/serviceAppWithLogger'
    },
    {
      id: 'composer',
      path: '../../no-entrypoint-composer'
    }
  ]
}
