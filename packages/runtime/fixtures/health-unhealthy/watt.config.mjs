// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'trace'
  },
  restartOnError: 500,
  gracefulShutdown: {
    runtime: 500,
    service: 500
  },
  health: {
    maxUnhealthyChecks: 1,
    enabled: true,
    gracePeriod: 100,
    interval: 200,
    maxELU: 0.001,
    maxHeapUsed: 0.001,
    maxHeapTotal: '256Mb',
    maxYoungGeneration: '128Mb'
  },
  metrics: true,
  applications: [
    {
      id: 'service-1',
      path: './service-1'
    },
    {
      id: 'service-2',
      path: './service-2'
    }
  ]
}
