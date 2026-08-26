// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/next',
  logger: {
    level: 'warn'
  },
  cache: {
    adapter: 'valkey',
    url: `valkey://${process.env.VALKEY_URL}`,
    prefix: 'plt:test:caching-valkey'
  },
  next: {
    useExperimentalAdapter: true
  },
  server: {
    port: 0
  }
}
