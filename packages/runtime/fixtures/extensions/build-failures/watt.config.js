// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  extensions: [
    {
      path: '../extension-build-failures.js',
      options: {
        name: 'first'
      },
      build: true
    },
    {
      path: '../extension-build-failures.js',
      options: {
        name: 'second'
      },
      build: true
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
