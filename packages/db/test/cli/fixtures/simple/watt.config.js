// A v4 configuration in its own directory: one per directory is the rule, so each of these
// fixtures owns one. The migrations they point at stay where they were.
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
    connectionString: process.env.DATABASE_URL
  },
  migrations: {
    dir: '../migrations',
    table: 'versions',
    autoApply: false,
    validateChecksums: true
  }
}
