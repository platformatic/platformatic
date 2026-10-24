// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  extensions: [
    {
      path: '../extension-1.js',
      options: {
        greeting: 'hello'
      }
    },
    '../extension-2.js'
  ],
  autoload: {
    path: '../services',
    exclude: [
      'b',
      'crash-on-start'
    ]
  },
  logger: {
    level: 'error'
  }
}
