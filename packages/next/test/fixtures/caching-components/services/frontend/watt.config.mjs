// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/next',
  logger: {
    level: 'error'
  },
  cache: {
    adapter: 'valkey',
    url: `valkey://${process.env.VALKEY_URL}`,
    prefix: 'plt:test:caching-valkey',
    cacheComponents: true
  },
  server: {
    port: 0
  }
}
