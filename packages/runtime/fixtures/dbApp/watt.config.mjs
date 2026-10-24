// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/db',
  server: {
    hostname: '127.0.0.1',
    port: 0,
    logger: {
      level: 'fatal'
    }
  },
  migrations: {
    dir: 'migrations',
    table: 'versions'
  },
  types: {
    autogenerate: false
  },
  db: {
    connectionString: 'sqlite://db.sqlite',
    graphql: true,
    ignore: {
      versions: true
    },
    events: false
  },
  plugins: {
    paths: [
      'plugin.js'
    ]
  },
  watch: false
}
