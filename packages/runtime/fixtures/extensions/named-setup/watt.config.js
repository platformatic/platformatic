// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  extensions: [
    {
      path: '../extension-named-setup.js',
      options: {
        greeting: 'hello'
      }
    }
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
