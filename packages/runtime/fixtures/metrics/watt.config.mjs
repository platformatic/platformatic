// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  autoload: {
    path: './services'
  },
  logger: {
    level: 'silent'
  },
  managementApi: {
    logs: {
      maxSize: 6
    }
  },
  metrics: {
    httpClientMetrics: true,
    labels: {
      custom_label: 'custom-value'
    }
  }
}
