// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  autoload: {
    path: '../../monorepo',
    exclude: [
      'docs'
    ],
    mappings: {
      serviceAppWithLogger: {
        id: 'with-logger'
      },
      serviceAppWithMultiplePlugins: {
        id: 'multi-plugin-service'
      }
    }
  },
  gracefulShutdown: {
    runtime: 1000,
    application: 1000
  },
  logger: {
    level: 'silent'
  }
}
