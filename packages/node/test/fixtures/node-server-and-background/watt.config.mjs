// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'fatal'
  },
  watch: true,
  applications: [
    {
      id: 'frontend',
      path: './services/frontend'
    },
    {
      id: 'background',
      path: './services/background'
    }
  ]
}
