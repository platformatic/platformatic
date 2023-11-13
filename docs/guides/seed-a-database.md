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

module.exports = async function seed ({ entities, db, sql }) {
  await entities.graph.save({ input: { name: 'Hello' } })
  await db.query(sql`
    INSERT INTO graphs (name) VALUES ('Hello 2');
  `)
}
```

For Typescript use the following stub

```typescript title="seed.ts"
/// <reference path="./global.d.ts" />
import { Entities } from '@platformatic/sql-mapper'

const movies: object[] = [
  { title: 'Harry Potter' },
  { title: 'The Matrix' }
]

export async function seed (opts: { entities: Entities }) {
  for (const movie of movies) {
    await opts.entities.movie.save({ input: movie })
  }
}
```

:::info
Platformatic code will look for a `default` or `seed` function name when importing the file. Take a look at the `execute` function [here](https://github.com/platformatic/platformatic/blob/main/packages/db/lib/seed.mjs)
:::



We can then run the seed script with the Platformatic CLI:

```bash
npx platformatic db seed seed.js
```
