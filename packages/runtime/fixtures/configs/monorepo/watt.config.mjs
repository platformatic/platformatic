// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: false,
  autoload: {
    path: '../../monorepo',
    exclude: [
      'docs',
      'composerApp'
    ],
    mappings: {
      serviceAppWithLogger: {
        id: 'with-logger'
      },
      serviceAppWithMultiplePlugins: {
        id: 'multi-plugin-service'
      },
      dbApp: {
        id: 'db-app'
      }
    }
  },
  gracefulShutdown: {
    runtime: 2000,
    application: 2000
  },
  restartOnError: 1000
}
