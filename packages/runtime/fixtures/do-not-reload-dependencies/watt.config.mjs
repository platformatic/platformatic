// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  server: {
    hostname: '127.0.0.1',
    port: Number(process.env.PORT ?? 0),
    logger: {
      level: 'info'
    }
  },
  service: {
    openapi: true
  },
  plugins: {
    paths: [
      './plugin.js'
    ]
  }
}
