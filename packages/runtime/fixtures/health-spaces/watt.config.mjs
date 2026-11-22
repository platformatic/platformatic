// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'info'
  },
  managementApi: true,
  health: {
    enabled: true,
    gracePeriod: 500,
    interval: 1000,
    maxUnhealthyChecks: 3,
    maxHeapTotal: 268435456,
    maxYoungGeneration: 67108864
  },
  restartOnError: 1000,
  applications: [
    {
      id: 'service',
      path: './service',
      health: {
        maxELU: 0.3
      }
    }
  ]
}
