// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'trace'
  },
  managementApi: true,
  health: {
    enabled: true,
    gracePeriod: 500,
    interval: 500,
    maxUnhealthyChecks: 3
  },
  restartOnError: 500,
  applications: [
    {
      id: 'service',
      path: './service',
      health: {
        maxELU: 0.001
      }
    },
    {
      id: 'composer',
      path: './composer',
      health: {
        enabled: false
      }
    }
  ]
}
