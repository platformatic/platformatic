/*
  A v4 configuration in its own directory: one per directory is the rule, so this fixture owns one.
  The migrations it points at stay where they were.
*/
export default {
  module: '@platformatic/db',
  server: {
    hostname: '127.0.0.1',
    port: 3042
  },
  db: {
    connectionString: 'postgresql://gino.paoli',
    schema: []
  },
  migrations: {
    dir: '../migrations'
  }
}
