// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: true,
  autoload: {
    path: '../../monorepo-with-node',
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
  }
}
