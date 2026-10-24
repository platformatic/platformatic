// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'error'
  },
  metrics: true,
  applications: [
    {
      id: 'api',
      path: './services/api'
    },
    {
      id: 'internal',
      path: './services/internal'
    }
  ]
}
