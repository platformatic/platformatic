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
    application: 1000
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
