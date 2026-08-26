// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: true,
  metrics: true,
  restartOnError: false,
  gracefulShutdown: {
    application: 1000,
    runtime: 1000
  },
  applications: [
    {
      id: 'application-1',
      path: './application-1',
      dependencies: [
        'application-2'
      ]
    },
    {
      id: 'application-2',
      path: './application-2',
      dependencies: [
        'application-1'
      ]
    }
  ],
  logger: {
    level: 'fatal'
  }
}
