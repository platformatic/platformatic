# Programmatic API

In many cases it's useful to start Platformatic Service using an API instead of
command line, e.g. in tests we want to start and stop our server.

The `buildServer` function allows that:

```js
import { buildServer } from '@platformatic/service'

const server = await buildServer('path/to/platformatic.service.json')
  server: {
    hostname: '127.0.0.1',
    port: 0
  }
})

await server.listen()

const res = await fetch(server.url)
console.log(await res.json())

// do something

await server.stop()
```

It is also possible to customize the configuration:

```js
import { buildServer } from '@platformatic/service'

const server = await buildServer({
  server: {
    hostname: '127.0.0.1',
    port: 0
  }
})

await server.listen()

const res = await fetch(server.url)
console.log(await res.json())

// do something

await server.stop()
```

## Creating a reusable application on top of Platformatic Service

[Platformatic DB](/reference/db/introduction.md) is built on top of Platformatic Serivce.
If you want to build a similar kind of tool, follow this example:

```js
import { buildServer, ConfigManager, platformaticService } from '@platformatic/service'

class MyConfigManager {
  _transformConfig () {
    // Edit this.current at will, it's the current configuration
    console.log(this.current)
  }
}

async function myPlugin (app, opts) {
  // app.platformatic.configManager contains an instance of the ConfigManager
  console.log(app.platformatic.configManager.current)

  await platformaticService(app, opts)
}

// break Fastify encapsulation
myPlugin[Symbol.for('skip-override')] = true

const service = await buildServer('path/to/config.json', myPlugin, MyConfigManager)

await service.listen()

const res = await fetch(server.url)
console.log(await res.json())

// do something

await service.stop()
```
