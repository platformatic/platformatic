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
      },
      dbApp: {
        id: 'db-app',
        config: 'platformatic.db.json'
      }
    }
  },
  logger: {
    level: 'trace'
  },
  restartOnError: 1000,
  gracefulShutdown: {
    runtime: 1000,
    service: 1000
  },
  health: {
    enabled: true,
    gracePeriod: 5000,
    interval: 500
  },
  metrics: true
}
