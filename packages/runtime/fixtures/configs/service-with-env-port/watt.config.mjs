// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: false,
  autoload: {
    path: '../../monorepo',
    exclude: [
      'docs',
      'composerApp',
      'serviceApp'
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
  gracefulShutdown: {
    runtime: 1000,
    service: 1000
  },
  applications: [
    {
      id: 'serviceApp',
      path: '../../service-app-env-port'
    }
  ]
}
