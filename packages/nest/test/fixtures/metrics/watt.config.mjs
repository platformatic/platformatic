// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'error'
  },
  metrics: true,
  restartOnError: false,
  applications: [
    {
      id: 'frontend',
      path: './services/frontend'
    }
  ]
}
