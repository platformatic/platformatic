// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  metrics: true,
  logger: {
    level: 'info'
  },
  restartOnError: false,
  applications: [
    {
      id: 'frontend',
      path: './services/frontend'
    }
  ]
}
