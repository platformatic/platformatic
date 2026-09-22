// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  gracefulShutdown: {
    runtime: 1000,
    application: 1000
  },
  applications: [
    {
      id: 'without-openapi',
      path: '../../monorepo-openapi/serviceAppWithoutOpenapi'
    }
  ]
}
