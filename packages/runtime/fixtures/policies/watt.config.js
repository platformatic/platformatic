// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  policies: {
    deny: {
      "application-1": 'application-2'
    }
  },
  applications: [
    {
      id: 'application-1',
      path: './application-1'
    },
    {
      id: 'application-2',
      path: './application-2'
    },
    {
      id: 'application-3',
      path: './application-3'
    },
    {
      id: 'gateway',
      path: './gateway'
    }
  ]
}
