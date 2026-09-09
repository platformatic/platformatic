// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'info'
  },
  autoload: {
    path: '../services',
    exclude: [
      'non-existent'
    ]
  },
  applications: [
    {
      id: 'application-2',
      path: '../services/application-2'
    }
  ]
}
