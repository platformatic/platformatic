import Issues from '../../getting-started/issues.md';

# Programmatic API

Using the `@platformatic/runtime` API, you can start Platformatic applications programmatically, bypassing the command line. This API facilitates interaction with various application types such as `service`, `db`, `gateway`, and `runtime`, simplifying operations across different applications.

## `create()`

`create` function initializes a server based on a configuration object or file. It supports configurations for Platformatic Service, Platformatic DB, Platformatic Gateway, and any other applications developed on top of [Platformatic Service](../service/programmatic.md).

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
  // $schema: 'https://schemas.platformatic.dev/@platformatic/gateway/3.0.0.json'
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

## Adding and Removing applications at runtime

The Runtime object provides methods to dynamically add and remove applications during runtime execution.

### API Documentation

### `runtime.addApplications(applications, start = false)`

Dynamically adds new applications to a running runtime instance. This allows you to register applications after the runtime has been initialized.

If `start` is `true`, then the new application will immediately be started in parallel. Defaults to `false`.

**Important**: Application objects passed in the `applications` argument should always be processed via `prepareApplication` first to ensure proper options normalization.

```js
import { create, prepareApplication } from '@platformatic/runtime'

const app = await create('path/to/platformatic.runtime.json')
// const app = await create('path/to/watt.json')
await app.start()

// Prepare and add new applications dynamically
const newApplications = [
  await prepareApplication(app.getRuntimeConfig(true), { id: 'my-new-service', path: './new-service' })
]

await app.addApplications(newApplications, true) // true to start immediately
```

#### `runtime.removeApplications(applications, silent = false)`

Dynamically removes applications from the runtime. This will stop the applications and clean up their resources.

```js
import { create } from '@platformatic/runtime'

const app = await create('path/to/watt.json')
await app.start()

// Remove applications by ID
const applicationsToRemove = ['service-1', 'service-2']

await app.removeApplications(applicationsToRemove)
```

If `silent` is `true`, then logging will be suppressed during the removal process. Defaults to `false`.

**Important**: The entrypoint application cannot be removed, attempting to do so will throw a `CannotRemoveEntrypointError`.

### Example: Dynamic Service Management

```js
import { create, prepareApplication } from '@platformatic/runtime'

const app = await create('path/to/watt.json')
await app.start()

// Add a new service dynamically
const newService = await prepareApplication(app.getRuntimeConfig(true), {
  id: 'analytics-service',
  path: './analytics',
  workers: 2
})

await app.addApplications([newService], true)

// Later, remove it when no longer needed
await app.removeApplications(['analytics-service'])
```

<Issues />
