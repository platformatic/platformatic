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
