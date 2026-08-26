// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  autoload: {
    exclude: [
      'docs',
      'composerApp'
    ],
    mappings: {
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
