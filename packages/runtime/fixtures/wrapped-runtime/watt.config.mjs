// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/db',
  db: {
    connectionString: 'sqlite://db.sqlite',
    graphql: true,
    ignore: {
      versions: true
    },
    events: false
  },
  runtime: {
    watch: false,
    server: {
      port: 1234
    },
    autoload: {
      path: 'autoloaded'
    },
    web: [
      {
        id: 'alternate',
        origin: 'http://localhost:5678'
      }
    ],
    services: [
      {
        id: 'another',
        path: './another'
      }
    ]
  }
}
