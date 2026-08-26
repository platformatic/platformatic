// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: false,
  workers: 2,
  autoload: {
    path: '../../monorepo',
    exclude: [
      'docs',
      'composerApp',
      'dbApp'
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
  gracefulShutdown: {
    runtime: 2000,
    service: 2000
  },
  restartOnError: 1000
}
