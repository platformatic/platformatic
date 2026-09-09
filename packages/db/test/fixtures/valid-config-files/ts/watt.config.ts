/*
  The same configuration in each of the four names v4 accepts. They differ only in language and
  module system: `.ts`/`.mts` are TypeScript, and the `m` prefix is what lets a file be ESM in a
  package that does not declare "type": "module".
*/
const configuration = {
  module: '@platformatic/db',
  db: {
    connectionString: process.env.DATABASE_URL
  },
  server: {
    hostname: '127.0.0.1',
    port: 0 as number,
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

export default configuration
