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
        id: 'with-logger',
        config: 'platformatic.service.json'
      },
      serviceAppWithMultiplePlugins: {
        id: 'multi-plugin-service',
        config: 'platformatic.service.json'
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
