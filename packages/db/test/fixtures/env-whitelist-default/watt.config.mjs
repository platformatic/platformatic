/*
  A configuration reading its environment directly. v3 substituted `{HOSTNAME}` and refused any
  variable outside the `PLT_` prefix unless a whitelist named it; a program has no whitelist to
  keep, so these read what they need.
*/
export default {
  module: '@platformatic/db',
  server: {
    hostname: '127.0.0.1',
    port: Number(process.env.PORT ?? 0),
    logger: {
      level: 'info'
    }
  },
  db: {
    connectionString: process.env.DATABASE_URL
  }
}
