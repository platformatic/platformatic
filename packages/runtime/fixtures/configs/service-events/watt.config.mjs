// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  gracefulShutdown: {
    runtime: 1000,
    application: 1000
  },
  restartOnError: 1000,
  logger: {
    level: 'fatal'
  },
  applications: [
    {
      id: 'serviceThrowsOnStart',
      path: '../../serviceAppThrowsOnStart'
    }
  ]
}
