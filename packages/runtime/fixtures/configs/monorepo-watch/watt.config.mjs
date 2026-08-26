// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: true,
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
  logger: {
    level: 'trace'
  },
  restartOnError: 1000,
  gracefulShutdown: {
    runtime: 1000,
    service: 1000
  }
}
