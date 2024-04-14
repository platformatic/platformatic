# Programmatic API

In many cases it's useful to start Platformatic applications using an API
instead of the command line. The `@platformatic/runtime` API makes it simple to
work with different application types (e.g. `service`, `db`, `composer` and `runtime`) without
needing to know the application type a priori.

## `buildServer()`

The `buildServer` function creates a server from a provided configuration
object or configuration filename.
The config can be of either Platformatic Service, Platformatic DB,
Platformatic Composer or any other application built on top of
[Platformatic Service](/reference/service/programmatic.md).

```js
import { buildServer } from '@platformatic/runtime'

const app = await buildServer('path/to/platformatic.runtime.json')
const entrypointUrl = await app.start()

// Make a request to the entrypoint.
const res = await fetch(entrypointUrl)
console.log(await res.json())

// Do other interesting things.

await app.close()
```

It is also possible to customize the configuration:


```js
import { buildServer } from '@platformatic/runtime'

const config = {
  // $schema: 'https://platformatic.dev/schemas/v0.39.0/runtime',
  // $schema: 'https://platformatic.dev/schemas/v0.39.0/service',
  // $schema: 'https://platformatic.dev/schemas/v0.39.0/db',
  // $schema: 'https://platformatic.dev/schemas/v0.39.0/composer'
  ...
}
const app = await buildServer(config)

await app.start()
```


## `loadConfig()`

The `loadConfig` function is used to read and parse a configuration file for
an arbitrary Platformatic application.

```js
import { loadConfig } from '@platformatic/runtime'

// Read the config based on command line arguments. loadConfig() will detect
// the application type.
const config = await loadConfig({}, ['-c', '/path/to/platformatic.config.json'])

// Read the config based on command line arguments. The application type can
// be provided explicitly.
const config = await loadConfig(
  {},
  ['-c', '/path/to/platformatic.config.json']
)

// Default config can be specified.
const config = await loadConfig(
  {},
  ['-c', '/path/to/platformatic.config.json'],
  { key: 'value' }
)
```

## `start()`

The `start` function loads a configuration, builds a server, and starts the
server. However, the server is not returned.

```js
import { start } from '@platformatic/runtime'

await start(['-c', '/path/to/platformatic.config.json])
```

## `startCommand()`

The `startCommand` function is similar to `start`. However, if an exception
occurs, `startCommand` logs the error and exits the process. This is different
from `start`, which throws the exception.

```js
import { startCommand } from '@platformatic/runtime'

await startCommand(['-c', '/path/to/platformatic.config.json])
```
