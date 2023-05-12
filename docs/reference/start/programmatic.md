# Programmatic API

In many cases it's useful to start Platformatic applications using an API
instead of the command line. The `@platformatic/start` API makes it simple to
work with different application types (e.g. `service`, `db`) without needing to
know the application type a priori.

## `buildServer()`

The `buildServer` function creates a server from a provided configuration
object or configuration filename.

```js
import { buildServer } from '@platformatic/start'

// This config can also be a config filename or obtained via loadConfig().
const config = {
  server: {
    hostname: '127.0.0.1',
    port: 0
  }
}
const app = await buildServer(config)

await app.start()
```

## `getConfigType()`

The `getConfigType` function takes an array of command line arguments and a
directory, and returns a string indicating the application type.

```js
import { getConfigType } from '@platformatic/start'

// Get the type from command line arguments.
const type = await getConfigType(['-c', '/path/to/platformatic.config.json'])

// Search a directory for a config file and get the type from that file.
const type = await getConfigType(undefined, '/directory/of/project')

// Search a the current working directory for a config file and get the type
// from that file.
const type = await getConfigType()
```

## `getCurrentSchema()`

The `getCurrentSchema` function takes a Platformatic application type as input,
and returns the corresponding configuration file schema for the current version.
If the input is not a recognized application type, an exception will be thrown.

```js
import { getCurrentSchema } from '@platformatic/start'

// Get the type from command line arguments.
const type = await getCurrentSchema('service')
```

## `loadConfig()`

The `loadConfig` function is used to read and parse a configuration file for
an arbitrary Platformatic application.

```js
import { loadConfig } from '@platformatic/start'

// Read the config based on command line arguments. loadConfig() will detect
// the application type.
const config = await loadConfig({}, ['-c', '/path/to/platformatic.config.json'])

// Read the config based on command line arguments. The application type can
// be provided explicitly.
const config = await loadConfig(
  {},
  ['-c', '/path/to/platformatic.config.json'],
  undefined,
  'service'
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
import { start } from '@platformatic/start'

await start(['-c', '/path/to/platformatic.config.json])
```

## `startCommand()`

The `startCommand` function is similar to `start`. However, if an exception
occurs, `startCommand` logs the error and exits the process. This is different
from `start`, which throws the exception.

```js
import { start } from '@platformatic/start'

await startCommand(['-c', '/path/to/platformatic.config.json])
```
