// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'info'
  },
  metrics: true,
  applications: [
    {
      id: 'frontend',
      path: './services/frontend'
    },
    {
      id: 'backend',
      path: './services/backend'
    }
  ]
}
