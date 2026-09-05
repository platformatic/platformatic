// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/db',
  server: {
    hostname: process.env.PLT_SERVER_HOSTNAME,
    port: Number(process.env.PORT ?? 0),
    logger: {
      level: process.env.PLT_SERVER_LOGGER_LEVEL
    }
  },
  db: {
    connectionString: process.env.DATABASE_URL,
    graphql: true,
    openapi: true
  },
  watch: {
    ignore: [
      '*.sqlite',
      '*.sqlite-journal'
    ]
  },
  migrations: {
    dir: 'migrations'
  },
  plugins: {
    paths: [
      'plugin.ts'
    ]
  },
  types: {
    autogenerate: true
  }
}
