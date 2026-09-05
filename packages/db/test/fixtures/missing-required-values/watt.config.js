/*
  A v4 configuration in its own directory: one per directory is the rule, so this fixture owns one.
  The migrations it points at stay where they were.
*/
export default {
  module: '@platformatic/db',
  db: {
    connectionString: process.env.DATABASE_URL
  },
  migrations: {
    table: 'versions',
    autoApply: false
  }
}
