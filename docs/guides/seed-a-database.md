# Seed a Database

A database is as useful as the data that it contains: a fresh, empty database
isn't always the best starting point. We can add a few rows from our migrations
using SQL, but we might need to use JavaScript from time to time.

The [platformatic db seed](/reference/cli.md#seed) command allows us to run a
script that will populate — or "seed" — our database.

## Example

Our seed script should export a `Function` that accepts an argument:
an instance of [`@platformatic/sql-mapper`](/reference/sql-mapper/introduction.md).

```javascript title="seed.js"
'use strict'

module.exports = async function ({ entities, db, sql }) {
  await entities.graph.save({ input: { name: 'Hello' } })
  await db.query(sql`
    INSERT INTO graphs (name) VALUES ('Hello 2');
  `)
}
```

We can then run the seed script with the Platformatic CLI:

```bash
npx platformatic db seed seed.js
```
