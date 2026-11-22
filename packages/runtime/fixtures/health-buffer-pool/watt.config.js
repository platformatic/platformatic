// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'info'
  },
  health: {
    enabled: false,
    bufferPoolSize: 262144,
    defaultHighWaterMark: 262144
  },
  restartOnError: 1000,
  applications: [
    {
      id: 'service',
      path: './service'
    }
  ]
}
