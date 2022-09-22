# Introduction to the Platformatic DB Mapper

The Platformatic DB Mapper will inspect a database schema and return an object containing:

- `db` — A database abstraction layer from [`@databases`](https://www.atdatabases.org/)
- `sql` — The SQL builder from [`@databases`](https://www.atdatabases.org/)
- `entities` — An object containing a key for each table found in the schema, with basic CRUD operations. See [Entity Reference](./entities/introduction.md) for details.

It exports a function that accepts an object with the following properties:

- `connectionString` — The Database connection string
- `log` — A logger object (like [Pino](https://getpino.io))
- `onDatabaseLoad` — An async function that is called after the connection is established. It will receive `db` and `sql` as parameter.
- `ignore` — Object used to ignore some tables from building entities. (i.e. `{ 'versions': true }` will ignore `versions` table)
- `autoTimestamp` — Generate timestamp automatically when inserting/updating records.
- `hooks` — For each entity name (like `Page`) you can customize any of the entity API function. Your custom function will receive the original function as first parameter, and then all the other parameters passed to it.

## Code samples

```javascript
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
  }
})
const pageEntity = mapper.entities.page

await mapper.db.query(mapper.sql`SELECT * FROM pages`)
await mapper.db.find('option1', 'option2')
```
