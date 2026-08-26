// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  strictEnv: true,
  watch: process.env.PLT_STRICT_ENV_WATCH,
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
  gracefulShutdown: {
    runtime: 1000,
    service: 1000
  }
}
