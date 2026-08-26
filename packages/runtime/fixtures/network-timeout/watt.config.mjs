// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: true,
  metrics: false,
  healthProbes: {
    port: 0
  },
  restartOnError: 500,
  autoload: {
    path: '.',
    mappings: {
      "service-2": {
        id: 'service-2'
      }
    }
  },
  logger: {
    level: 'info'
  },
  serviceTimeout: 100
}
