/*
  The same configuration under each of the four accepted names. This fixture was once kept in six
  serialized formats -- json, json5, yaml, yml, toml, tml -- and the test read one of each; a
  configuration is now a program, so what varies is the language and the module system.
*/
export default {
  module: '@platformatic/db',
  server: {
    hostname: '127.0.0.1',
    port: 0,
    logger: {
      level: 'info'
    }
  },
  db: {
    connectionString: process.env.DATABASE_URL
  },
  migrations: {
    dir: './migrations',
    table: 'versions',
    autoApply: false
  }
}
