# Platformatic DB Programmatic API

In many cases it's useful to start Platformatic DB using an API instead of
command line, e.g. in tests we want to start and stop our server.

The `buildServer` function allows that:

```js
import { buildServer } from '@platformatic/db'

const db = await buildServer('path/to/platformatic.db.json')

await db.listen()

const res = await fetch(server.url)
console.log(await res.json())

// do something

await db.stop()
```

It is also possible to customize the configuration:

```js
import { buildServer } from '@platformatic/db'

const db = await buildServer({
  server: {
    hostname: '127.0.0.1',
    port: 0
  },
  core: {
    // Use an in-memory database for testing purposes
    connectionString: 'sqlite://:memory:'
  },
  dashboard: true,
  authorization: {
    adminSecret: 'secret'
  }
})

await db.listen()

const res = await fetch(server.url)
console.log(await res.json())

// do something

await db.stop()
```

For more details on how this is implemented, read [Platformatic Service Programmatic API](/reference/service/programmatic.md).
