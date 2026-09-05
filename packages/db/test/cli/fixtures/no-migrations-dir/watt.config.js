// A v4 configuration in its own directory: one per directory is the rule, so each of these
// fixtures owns one. The migrations they point at stay where they were.
export default {
  module: '@platformatic/db',
  db: {
    connectionString: process.env.DATABASE_URL
  },
  migrations: {}
}
