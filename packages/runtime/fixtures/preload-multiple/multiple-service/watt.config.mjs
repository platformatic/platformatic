// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  preload: [
    '../preload-1.js',
    '../preload-2.js'
  ],
  logger: {
    level: 'error'
  },
  applications: [
    {
      id: 'a',
      path: '../services/a',
      preload: [
        '../preload-3.js',
        '../preload-4.js'
      ],
      nodeOptions: '--network-family-autoselection-attempt-timeout=100'
    },
    {
      id: 'b',
      path: '../services/b',
      preload: '../preload-5.js',
      nodeOptions: '--network-family-autoselection-attempt-timeout=200'
    },
    {
      id: 'c',
      path: '../services/c',
      nodeOptions: '--network-family-autoselection-attempt-timeout=300'
    },
    {
      id: 'composer',
      path: '../services/composer'
    }
  ]
}
