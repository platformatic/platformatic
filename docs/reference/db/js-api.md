# JavaScript API

It's possible to start an instance of Platformatic DB from JavaScript.

```js
import { buildServer } from '@platformatic/db'

await buildServer({
  server: {
    hostname: '127.0.0.1',
    port: 0
  },
  core: {
    connectionString: 'sqlite://test.sqlite'
  },
})

await server.listen() // this will start our server

console.log('URL', server.url)

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

## API

### buildServer(config)

Returns an instance of the [server](#Server)

### Server

#### .listen()

Listen to the hostname/port combination specified in the config.

#### .app

The fastify application.
This enables you to do [`server.app.inject()` calls](https://www.fastify.io/docs/latest/Guides/Testing/#benefits-of-using-fastifyinject).

#### .restart(newConfig)

Restart the Fastify application with the new configuration
