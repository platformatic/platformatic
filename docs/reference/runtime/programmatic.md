import Issues from '../../getting-started/issues.md';

# Programmatic API

Using the `@platformatic/runtime` API, you can start Platformatic applications programmatically, bypassing the command line. This API facilitates interaction with various application types such as `service`, `db`, `composer`, and `runtime`, simplifying operations across different services. 

## `buildServer()`

`buildServer` function initializes a server based on a configuration object or file. It supports configurations for Platformatic Service, Platformatic DB, Platformatic Composer, and any other applications developed on top of [Platformatic Service](../service/programmatic.md).


```js
import { buildServer } from '@platformatic/runtime'

// Initialize the server using a configuration file
const app = await buildServer('path/to/platformatic.runtime.json')
const entrypointUrl = await app.start()

// Sample request to the server's entrypoint
const res = await fetch(entrypointUrl)
console.log(await res.json())

// Perform other operations

await app.close()
```

## Custom Configuration 

You can customize your server setup directly within your code by specifying the configuration details:


```js
import { buildServer } from '@platformatic/runtime'

const config = {
  // $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/1.52.0.json',
  // $schema: 'https://schemas.platformatic.dev/@platformatic/service/1.52.0.json',
  // $schema: 'https://schemas.platformatic.dev/@platformatic/db/1.52.0.json',
  // $schema: 'https://schemas.platformatic.dev/@platformatic/composer/1.52.0.json'
  ...
}
const app = await buildServer(config)

await app.start()
```


## `loadConfig()` 

The `loadConfig` function reads and parses a configuration file for any Platformatic application. It can automatically detect the type of application or accept explicit instructions.

```js
import { loadConfig } from '@platformatic/runtime'

// Read the configuration and automatically detect the application type.
const config = await loadConfig({}, ['-c', '/path/to/platformatic.config.json'])

// Read the config based on command line arguments and provide default configuration if needed
const config = await loadConfig(
  {},
  ['-c', '/path/to/platformatic.config.json']
)

// Specify a default config 
const config = await loadConfig(
  {},
  ['-c', '/path/to/platformatic.config.json'],
  { key: 'value' }
)
```

## `start()`

The `start` function loads a configuration, builds and starts a server but does not return the server instance. This function is best suited for scenarios where no further interaction with the server is necessary after launch.

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

<Issues />
