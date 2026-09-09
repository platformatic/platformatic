// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  applications: [
    {
      id: 'composer',
      path: '../services/composer'
    },
    {
      id: 'service-2',
      path: '../services/service-2',
      dependencies: [
        'service-1'
      ]
    },
    {
      id: 'service-3',
      path: '../services/service-3'
    },
    {
      id: 'service-1',
      path: '../services/service-1'
    }
  ],
  restartOnError: false
}
