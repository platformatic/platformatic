# Introduction to @platformatic/sql-mapper

`@platformatic/sql-mapper` is the underlining utility that Platformatic DB uses to create useful utilities to
manipulate your SQL database using JavaScript.

This module is bundled with [Platformatic DB](/reference/db/introduction.md) via [a fastify plugin](./fastify-plugin.md)
The rest of this guide shows how to use this module directly.

## Install

```
npm i @platformatic/sql-mapper
```

## API

### `connect(opts) : Promise`

It will inspect a database schema and return an object containing:


- `db` — A database abstraction layer from [`@databases`](https://www.atdatabases.org/).
- `sql` — The SQL builder from [`@databases`](https://www.atdatabases.org/).
- `entities` — An object containing a key for each table found in the schema, with basic CRUD operations. See [Entity Reference](./entities/introduction.md) for details.

The valid options are:

- `connectionString` — The Database connection string.
- `poolSize` - Maximum number of connections in the connection pool. The default `poolSize` is `10`.
- `log` — A logger object (like [Pino](https://getpino.io)).
- `onDatabaseLoad` — An async function that is called after the connection is established. It will receive `db` and `sql` as parameters.
- `ignore` — An object used to ignore specified tables from building entities (i.e. `{ 'versions': true }` will ignore the `versions` table).
- `include` — An object used to explicitly identify tables for which you would like entities built (i.e. `{ 'versions': true }` will build a `versions` entity from the `versions` table and ignore all other tables).
- `autoTimestamp` — Flag to enable automatic generation of a timestamp when inserting or updating records.
- `hooks` — An object to customize entity API functions for each entity. Your custom function will receive the original function as the first parameter and all other parameters passed to it.
- `cache` — Flag to enable cache and dedupe features (default is `false`, i.e. disabled). This is currently only supported during schema enumeration.

### `createConnectionPool(opts) : Promise`

It will inspect a database schema and return an object containing:


- `db` — A database abstraction layer from [`@databases`](https://www.atdatabases.org/)
- `sql` — The SQL builder from [`@databases`](https://www.atdatabases.org/)

The valid options are:

- `connectionString` — The Database connection string
- `poolSize` - Maximum number of connections in the connection pool (default `poolSize` is `10`)
- `log` — A logger object (like [Pino](https://getpino.io))

This utility is useful if you just need to connect to the db without generating any entity.

## Code samples

```javascript
const { connect } = require('@platformatic/sql-mapper')
const { pino } = require('pino')

const logger = pino()

async function onDatabaseLoad (db, sql) {
  await db.query(sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL
  );`)
}
const connectionString =
  'postgres://postgres:postgres@localhost:5432/postgres'
const mapper = await connect({
  connectionString,
  log: logger,
  onDatabaseLoad,
  ignore: {},
  hooks: {
    Page: {
      find: async function(_find, opts) {
        console.log('hook called');
        return await _find(opts)
      }
    }
  },
  cache: true
})
const pageEntity = mapper.entities.page

await mapper.db.query(mapper.sql`SELECT * FROM pages`)
await mapper.db.find('option1', 'option2')
```
