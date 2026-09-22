// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'fatal'
  },
  undici: {
    interceptors: [
      {
        module: './mock-external-image.mjs',
        options: {}
      }
    ]
  },
  applications: [
    {
      id: 'optimizer',
      path: './services/optimizer'
    },
    {
      id: 'fallback',
      path: './services/fallback'
    }
  ]
}
