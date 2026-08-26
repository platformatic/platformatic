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
      }
    }
  },
  gracefulShutdown: {
    runtime: 1000,
    service: 1000
  }
}
