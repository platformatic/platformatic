// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  autoload: {
    path: '../../monorepo',
    exclude: [
      'docs',
      'composerApp'
    ],
    mappings: {
      serviceAppWithLogger: {
        id: 'with-logger'
      }
    }
  },
  gracefulShutdown: {
    runtime: 1000,
    application: 1000
  }
}
