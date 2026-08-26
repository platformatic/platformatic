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
        id: 'with-logger',
        config: 'platformatic.service.json'
      },
      serviceAppWithMultiplePlugins: {
        id: 'multi-plugin-service',
        config: 'platformatic.service.json'
      },
      dbApp: {
        id: 'db-app',
        config: 'platformatic.db.json'
      }
    }
  },
  metrics: {
    labels: {
      app: 'serviceApp'
    }
  },
  gracefulShutdown: {
    runtime: 1000,
    service: 1000
  }
}
