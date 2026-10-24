// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  extensions: [
    {
      path: '../extension-faux-esm-default.cjs',
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
