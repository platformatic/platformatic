// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'info'
  },
  applications: [
    {
      id: 'composer',
      path: '../services/composer',
      server: {
        hostname: '127.0.0.1'
      }
    }
  ],
  autoload: {
    path: '../services',
    exclude: [
      'application-2',
      'application-3',
      'composer'
    ]
  }
}
