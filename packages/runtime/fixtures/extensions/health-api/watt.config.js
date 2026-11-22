// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  extensions: [
    {
      path: '../extension-health-api.js',
      options: {
        id: 'primary'
      }
    }
  ],
  autoload: {
    path: '../services',
    exclude: [
      'crash-on-start'
    ]
  },
  metrics: {
    hostname: '127.0.0.1',
    port: Number(process.env.METRICS_PORT)
  },
  logger: {
    level: 'error'
  }
}
