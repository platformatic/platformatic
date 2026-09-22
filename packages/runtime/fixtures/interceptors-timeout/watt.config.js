// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'info'
  },
  startTimeout: 3000,
  gracefulShutdown: {
    application: 1000,
    runtime: 1000
  },
  restartOnError: false,
  applications: [
    {
      id: 'main',
      path: 'services/main'
    }
  ]
}
