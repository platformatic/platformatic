// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/db',
  db: {
    connectionString: process.env.DATABASE_URL
  },
  server: {
    hostname: '127.0.0.1',
    port: 0,
    logger: {
      level: 'info'
    }
  },
  migrations: {
    dir: './migrations',
    table: 'versions',
    autoApply: true
  }
}
