// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  autoload: {
    path: './services'
  },
  logger: {
    level: 'trace'
  },
  managementApi: {
    logs: {
      maxSize: 6
    }
  },
  metrics: {
    port: 0,
    labels: {
      custom_label: 'custom-value'
    }
  }
}
