import Issues from '../../getting-started/issues.md';

# Programmatic API

In many cases, it's useful to start Platformatic Service using an API instead of the command line, e.g., in tests where we want to start and stop our server programmatically.

## Using `create` Function

The `create` function allows starting the Platformatic Service programmatically.

### Basic Example

```js title="server.js"
import { create } from '@platformatic/service'

const app = await create('path/to/platformatic.service.json')

await app.start()

const res = await fetch(app.url)
console.log(await res.json())

// do something

await app.close()
```

### Custom Configuration

It is also possible to customize the configuration:

```js
import { create } from '@platformatic/service'

const app = await create('path/to', {
  server: {
    hostname: '127.0.0.1',
    port: 0
  }
})

await app.start()

const res = await fetch(app.url)
console.log(await res.json())

// do something

await app.close()
```

## Creating a Reusable Application on Top of Platformatic Service

[Platformatic DB](../db/overview.md) is built on top of Platformatic Service. If you want to build a similar kind of tool, follow this example:

```js title="Example Plugin"
import { create, schema as serviceSchema, transform as serviceTransform } from '@platformatic/service'
import { readFileSync } from 'node:fs'

async function myPlugin (app, capability) {
  await platformaticService(app, capability)

  await app.register(platformaticService, opts)
}

// break Fastify encapsulation
myPlugin[Symbol.for('skip-override')] = true

// This is the schema for this reusable application configuration file,
// customize at will but retain the base properties of the schema from
// @platformatic/service
const schema = { ...serviceSchema }

// In this method you can alter the configuration before the application
// is started. It's useful to apply some defaults that cannot be derived
// inside the schema, such as resolving paths.
async function transform (config, schema, options) {
  config = await serviceTransform(config, schema, options)

  // do something

  return config
}

const server = await create('path/to/config.json', null, { schema, applicationFactory: myPlugin, transform })

await server.start()

const res = await fetch(server.listeningOrigin)
console.log(await res.json())

// do something

await service.close()
```

## TypeScript Support

To ensure this module works in a TypeScript setup (outside an application created with `npm create wattpm`), you need to
import types from `@platformatic/service`.

### Type Declarations

```ts
import { ServerInstance } from '@platformatic/service'

export default async function myPlugin (app: ServerInstance) {
  app.get('/', async () => {
    return app.platformatic.config
  })
}
```

## Usage with Custom Configuration

If you are creating a reusable application on top of Platformatic Service, you would need to create the types for your schema,
using [json-schema-to-typescript](https://www.npmjs.com/package/json-schema-to-typescript) in a `./config.d.ts` file and
use it like this:

### Custom Configuration Types

```ts
import { ServerInstance } from '@platformatic/service'
import { YourApp } from './config'

export default async function myPlugin (app: ServerInstance<YourApp>) {
  app.get('/', async () => {
    return app.platformatic.config
  })
}
```

## Writing a Custom Capability with TypeScript

Creating a reusable application with TypeScript requires a bit of setup. First, create a `schema.ts` file that generates the JSON Schema for your application.

### Schema Definition

```ts
import { schema as serviceSchema } from '@platformatic/service'

export const schema = structuredClone(serviceSchema)

schema.$id = 'https://raw.githubusercontent.com/platformatic/acme-base/main/schemas/1.json'
schema.title = 'Acme Base'

// Needed to specify the extended module
schema.properties.extends = {
  type: 'string'
}

schema.properties.dynamite = {
  anyOf: [
    {
      type: 'boolean'
    },
    {
      type: 'string'
    }
  ],
  description: 'Enable /dynamite route'
}

delete schema.properties.plugins

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}
```

#### Generate Matching Types

Use [json-schema-to-typescript](http://npm.im/json-schema-to-typescript) to generate types:

1. `tsc && node dist/lib/schema.js > schemas/acme.json`
2. `json2ts < schemas/acme.json > src/lib/config.d.ts`

Finally, you can write the actual reusable application:

```ts
import { type FastifyInstance } from 'fastify'
import { lstat } from 'node:fs/promises'
import { kMetadata, RawConfiguration, ConfigurationOptions } from '@platformatic/foundation'
import { resolve } from 'node:path'
import {
  create as createService,
  platformaticService,
  ServerInstance,
  type PlatformaticServiceConfig as ServiceConfig,
  ServiceCapability,
  transform as serviceTransform
} from '@platformatic/service'

import { type AcmeBaseConfig } from './config.js'
import dynamite from './dynamite.js'
import { schema } from './schema.js'

export { schema } from './schema.js'

async function isDirectory (path: string) {
  try {
    return (await lstat(path)).isDirectory()
  } catch {
    return false
  }
}

export default async function acmeBase (
  app: ServerInstance<ServiceConfig & AcmeBaseConfig>,
  capability: ServiceCapability
) {
  if (app.platformatic.config.dynamite) {
    app.register(dynamite)
  }

  await platformaticService(app, capability)
}

Object.assign(acmeBase, { [Symbol.for('skip-override')]: true })

export async function transform (config: ServiceConfig & AcmeBaseConfig): ServiceConfig & AcmeBaseConfig {
  // Call the transformConfig method from the base capability
  config = await serviceTransform(config)

  // In this method you can alter the configuration before the application
  // is started. It's useful to apply some defaults that cannot be derived
  // inside the schema, such as resolving paths.

  const paths = []

  const pluginsDir = resolve(config[kMetadata].root, 'plugins')

  if (await isDirectory(pluginsDir)) {
    paths.push({
      path: pluginsDir,
      encapsulate: false
    })
  }

  const routesDir = resolve(config[kMetadata].root, 'routes')

  if (await isDirectory(routesDir)) {
    paths.push({
      path: routesDir
    })
  }

  config.plugins = { paths }

  if (!config.service?.openapi) {
    if (typeof config.service !== 'object') {
      config.service = {}
    }

    config.service.openapi = {
      info: {
        title: 'Acme Microservice',
        description: 'A microservice for Acme Inc.',
        version: '1.0.0'
      }
    }
  }

  return config
}

export async function create (
  configOrRoot: string | RawConfiguration,
  sourceOrConfig: string | RawConfiguration,
  context: ConfigurationOptions
) {
  return createService(configOrRoot, sourceOrConfig, { schema, applicationFactory: acmeBase, transform, ...context })
}
```

## Implementing Auto-Upgrade of the Configuration

Platformatic support auto-upgrading the configuration of your capability to the latest version. This enables
the use of compatibility options to turn on and off individual features. Imagine that you want to change the
default behavior of your capability: you can add a configuration option to set the _previous_ behavior.
Then during the upgrade logic, you only have to add this new configuration.

The key to implement this logic is [semgrator](https://github.com/platformatic/semgrator).
`semgrator` run migrations code based on semantic version rules.
So on a breaking/behavior change that results in a new compatibility option in your configuration file,
you can add a new migration rule that set the new option to false automatically.

### Writing migrations

```
export const migration = {
  version: '1.0.0',
  up: (input) => {
    // Do something with Config
    return input
  },
}
```

### Wiring it to the capability

Pass a `upgrade` function to your `create` method.

```javascript
import { abstractLogger } from '@platformatic/foundation'
import { resolve } from 'node:path'
import { semgrator } from 'semgrator'

async function acmeBase (app, capability) {
  // ...
}

Object.assign(acmeBase, { [Symbol.for('skip-override')]: true })

async function transform (config, schema, options) {
  // ...
}

async function upgrade (logger, config, version) {
  const iterator = semgrator({
    version,
    path: resolve(import.meta.dirname, 'versions'),
    input: config,
    logger: logger?.child({ name: 'your-app' }) ?? abstractLogger
  })

  let result

  for await (const updated of iterator) {
    result = updated.result
  }

  return result
}

export async function create (configOrRoot, sourceOrConfig, context) {
  return createService(configOrRoot, sourceOrConfig, {
    applicationFactory: acmeBase,
    transform,
    upgrade,
    ...context
  })
}
```

<Issues />
