// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  autoload: {
    path: '../../monorepo',
    exclude: [
      'composerApp',
      'docs',
      'serviceAppWithMultiplePlugins',
      'serviceAppWithLogger'
    ],
    mappings: {
      serviceApp: {
        id: 'with-logger'
      }
    }
  },
  gracefulShutdown: {
    runtime: 1000,
    service: 1000
  }
}
