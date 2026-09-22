// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  gracefulShutdown: {
    runtime: 5000,
    application: 5000,
    closeConnections: false
  },
  applications: [
    {
      id: 'service',
      path: '../graceful-close-header/app'
    }
  ]
}
