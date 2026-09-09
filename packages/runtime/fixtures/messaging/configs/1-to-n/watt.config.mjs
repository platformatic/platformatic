// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: true,
  metrics: false,
  restartOnError: 500,
  logger: {
    level: 'info'
  },
  messagingTimeout: 2000,
  workers: 3,
  healthProbes: false,
  applications: [
    {
      id: 'first',
      path: '../../first',
      workers: 1
    },
    {
      id: 'second',
      path: '../../second'
    },
    {
      id: 'composer',
      path: '../../composer',
      workers: 1
    }
  ]
}
