// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'error'
  },
  undici: {
    interceptors: [
      {
        module: './interceptor.js',
        options: {}
      }
    ]
  },
  applications: [
    {
      id: 'frontend',
      path: './services/frontend'
    },
    {
      id: 'service-1',
      path: './services/service-1'
    }
  ]
}
