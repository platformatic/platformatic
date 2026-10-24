// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/db',
  server: {
    hostname: '127.0.0.1',
    port: 0
  },
  db: {
    connectionString: 'sqlite://db.sqlite',
    graphql: true,
    openapi: false,
    ignore: {
      versions: true
    },
    events: false
  }
}
