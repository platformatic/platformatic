// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/next',
  logger: {
    level: 'warn'
  },
  cache: {
    adapter: 'valkey',
    // v3 interpolated {VALKEY_URL} to '' when unset, so the URL fell back to the local instance.
    url: `valkey://${process.env.VALKEY_URL ?? ''}`,
    prefix: 'plt:test:caching-valkey'
  },
  next: {
    useExperimentalAdapter: true
  },
  server: {
    port: 0
  }
}
