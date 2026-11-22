// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  metrics: true,
  logger: {
    level: 'error'
  },
  applications: [
    {
      id: 'frontend',
      path: './services/frontend'
    },
    {
      id: 'backend',
      path: './services/backend'
    },
    {
      id: 'composer',
      path: './services/composer'
    }
  ]
}
