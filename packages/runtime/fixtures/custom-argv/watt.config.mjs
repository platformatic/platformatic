// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'error'
  },
  applications: [
    {
      id: 'a',
      path: 'services/main',
      arguments: [
        'first',
        'second',
        'third'
      ],
      logger: {
        level: 'error'
      }
    },
    {
      id: 'b',
      path: 'services/main',
      logger: {
        level: 'error'
      }
    }
  ]
}
