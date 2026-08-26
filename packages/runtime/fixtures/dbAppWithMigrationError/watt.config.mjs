// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/db',
  server: {
    hostname: '127.0.0.1',
    port: 3042
  },
  migrations: {
    autoApply: true,
    dir: 'migrations',
    table: 'versions'
  },
  types: {
    autogenerate: false
  },
  plugins: {
    paths: [
      'plugin.js'
    ]
  },
  db: {
    connectionString: 'sqlite://db.sqlite',
    graphql: true,
    ignore: {
      versions: true
    },
    events: false
  }
}
