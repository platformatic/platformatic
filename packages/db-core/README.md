# @platformatic/db-core

This modules wraps [`@platformatic/sql-mapper`](https://www.npmjs.com/package/@platformatic/sql-mapper),
[`@platformatic/sql-graphql`](https://www.npmjs.com/package/@platformatic/sql-graphql) and
[`@platformatic/sql-openapi`](https://www.npmjs.com/package/@platformatic/sql-openapi) in a convenient [Fastify](https://www.fastify.io/)
plugin.

Check out the full documentation for Platformatic DB on [our website](https://oss.platformatic.dev/docs/getting-started/quick-start-guide).

## Install

```sh
npm install @platformatic/db-core
```

## Usage

```js
import fastify from 'fastify'
import db from '@platformatic/db-core'

const app = Fastify()
app.register(db, {
  // connectionString: 'postgres://postgres:postgres@127.0.0.1/postgres'
  // connectionString: 'mysql://root@127.0.0.1:3307/graph'
  connectionString: 'sqlite://:memory:'
})
```

## License

Apache 2.0
