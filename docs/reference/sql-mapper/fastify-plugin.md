# Fastify Plugin

The `@platformatic/sql-mapper` package exports a [Fastify](https://fastify.io) plugin that can be used out-of the box in a server application.

A `connectionString` option must be passed to connect to your database.

The plugin decorates the server with a `platformatic` object that has the following properties:

- `db` — the DB wrapper object provided by [`@databases`](https://www.atdatabases.org/)
- `sql` — the SQL query mapper object provided by [`@databases`](https://www.atdatabases.org/)
- `entities` — all entity objects with their [API methods](./entities/api)
- `addEntityHooks` — a function to add a [hook](./entities/hooks) to an entity API method.

#### Usage

```js
'use strict'

const Fastify = require('fastify')
const mapper = require('@platformatic/sql-mapper')

async function main() {
  const app = Fastify({
    logger: {
      level: 'info'
    }
  })
  app.register(mapper.plugin, {
    connectionString: 'postgres://postgres:postgres@127.0.0.1/postgres'
  })

  app.get('/all-pages', async (req, reply) => {
    // Will return all rows from 'pages' table
    const res = await app.platformatic.entities.page.find()
    return res
  })

  await app.listen({ port: 3333 })
}

main()
```
