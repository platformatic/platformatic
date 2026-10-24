// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/db',
  server: {
    logger: {
      level: 'info'
    },
    hostname: '127.0.0.1',
    port: 3042
  },
  db: {
    connectionString: 'sqlite://db.sqlite',
    graphql: true,
    ignore: {
      versions: true
    }
  },
  migrations: {
    dir: 'migrations',
    table: 'versions',
    autoApply: true
  },
  types: {
    autogenerate: true
  },
  plugins: {
    paths: [
      'plugin.ts'
    ]
  },
  watch: true
}
