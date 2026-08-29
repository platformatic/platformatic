/*
  The same configuration under each of the four names v4 accepts. v3 kept this fixture in six
  serialized formats -- json, json5, yaml, yml, toml, tml -- and the test read one of each; a v4
  configuration is a program, so what varies now is the language and the module system.
*/
const configuration = {
  module: '@platformatic/db',
  server: {
    hostname: '127.0.0.1',
    port: 0 as number,
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

export default configuration
