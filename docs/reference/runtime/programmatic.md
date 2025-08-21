import Issues from '../../getting-started/issues.md';

# Programmatic API

Using the `@platformatic/runtime` API, you can start Platformatic applications programmatically, bypassing the command line. This API facilitates interaction with various application types such as `service`, `db`, `composer`, and `runtime`, simplifying operations across different applications.

## `create()`

`create` function initializes a server based on a configuration object or file. It supports configurations for Platformatic Service, Platformatic DB, Platformatic Composer, and any other applications developed on top of [Platformatic Service](../service/programmatic.md).

```js
import { create } from '@platformatic/runtime'

// Initialize the server using a configuration file
const app = await create('path/to/platformatic.runtime.json')
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
import { create } from '@platformatic/runtime'

const config = {
  // $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/3.0.0.json',
  // $schema: 'https://schemas.platformatic.dev/@platformatic/service/3.0.0.json',
  // $schema: 'https://schemas.platformatic.dev/@platformatic/db/3.0.0.json',
  // $schema: 'https://schemas.platformatic.dev/@platformatic/composer/3.0.0.json'
  ...
}
const app = await create(config)

await app.start()
```

## `loadConfiguration()`

The `loadConfig` function reads and parses a configuration file for any Platformatic application. It can automatically detect the type of application or accept explicit instructions.

```js
import { loadConfiguration } from '@platformatic/runtime'

// Read the configuration and automatically detect the application type.
const config = await loadConfiguration('/path/to/platformatic.config.json')
```

<Issues />
