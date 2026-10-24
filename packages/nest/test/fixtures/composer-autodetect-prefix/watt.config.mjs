// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'error'
  },
  restartOnError: false,
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
