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
      }
    }
  },
  managementApi: {},
  metrics: false,
  gracefulShutdown: {
    runtime: 1000,
    service: 1000
  }
}
