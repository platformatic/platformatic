// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: process.env.PLT_WATCH === 'true',
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
      }
    }
  },
  gracefulShutdown: {
    runtime: 1000,
    application: 1000
  }
}
