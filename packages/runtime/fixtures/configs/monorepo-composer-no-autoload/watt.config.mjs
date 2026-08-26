// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  gracefulShutdown: {
    runtime: 1000,
    service: 1000
  },
  applications: [
    {
      id: 'with-logger',
      path: '../../monorepo/serviceAppWithLogger'
    },
    {
      id: 'db-app',
      path: '../../monorepo/dbApp'
    },
    {
      id: 'composerApp',
      path: '../../monorepo/composerApp'
    },
    {
      id: 'multi-plugin-service',
      path: '../../monorepo/serviceAppWithMultiplePlugins'
    },
    {
      id: 'serviceApp',
      path: '../../monorepo/serviceApp'
    }
  ]
}
