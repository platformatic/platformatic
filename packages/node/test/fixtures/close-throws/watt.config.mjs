// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  gracefulShutdown: {
    runtime: 2000,
    application: 1000
  },
  logger: {
    level: 'error'
  },
  applications: [
    {
      id: 'frontend',
      path: './services/frontend'
    }
  ]
}
