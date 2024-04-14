# Programmatic API

It's possible to start an instance of Platformatic DB from JavaScript.

```js
import { buildServer } from '@platformatic/db'

const app = await buildServer('/path/to/platformatic.db.json')

await app.start() // this will start our server

console.log('URL', app.url)

const res = await fetch(app.url)
console.log(await res.json())

// do something

await app.close()
```

It is also possible to customize the configuration:

```js
import { buildServer } from '@platformatic/db'

const app = await buildServer({
  server: {
    hostname: '127.0.0.1',
    port: 0
  },
  db: {
    connectionString: 'sqlite://test.sqlite'
  },
})

await app.start() // this will start our server

console.log('URL', app.url)

const res = await fetch(app.url)
console.log(await res.json())

// do something

await app.close()
```

For more details on how this is implemented, read [Platformatic Service Programmatic API](/reference/service/programmatic.md).

## API

### buildServer(config)

Returns an instance of the [restartable application](#RestartableApp)

### RestartableApp

#### .start()

Listen to the hostname/port combination specified in the config.

#### .restart()

Restart the Fastify application

#### .close()

Stops the application.
