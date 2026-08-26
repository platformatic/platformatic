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
      id: 'with-logger',
      path: '../../monorepo/serviceAppWithLogger'
    },
    {
      id: 'with-logger',
      path: '../../monorepo/serviceAppWithLogger'
    }
  ]
}
