# Programmatic API

In many cases, it's useful to start Platformatic Service using an API instead of the command line, e.g., in tests where we want to start and stop our server programmatically.

## Using `buildServer` Function

The `buildServer` function allows starting the Platformatic Service programmatically.

### Basic Example 

```js title="server.js"
import { buildServer } from '@platformatic/service'

const app = await buildServer('path/to/platformatic.service.json')

await app.start()

const res = await fetch(app.url)
console.log(await res.json())

// do something

await app.close()
```

### Custom Configuration 

It is also possible to customize the configuration:

```js
import { buildServer } from '@platformatic/service'

const app = await buildServer({
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

[Platformatic DB](../db/overview.md) is built on top of Platformatic Serivce. If you want to build a similar kind of tool, follow this example:

```js title="Example Plugin"
import { buildServer, schema } from '@platformatic/service'
import { readFileSync } from 'node:fs'

async function myPlugin (app, opts) {
  // app.platformatic.configManager contains an instance of the ConfigManager
  console.log(app.platformatic.configManager.current)

  await app.register(platformaticService, opts)
}

// break Fastify encapsulation
myPlugin[Symbol.for('skip-override')] = true
myPlugin.configType = 'myPlugin'

// This is the schema for this reusable application configuration file,
// customize at will but retain the base properties of the schema from
// @platformatic/service
myPlugin.schema = schema

// The configuration of the ConfigManager
myPlugin.configManagerConfig = {
  version: JSON.parse(readFileSync(new URL(import.meta.url, 'package.json'), 'utf-8')).version
  schema: foo.schema,
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  },
  async transformConfig () {
    console.log(this.current) // this is the current config

    // In this method you can alter the configuration before the application
    // is started. It's useful to apply some defaults that cannot be derived
    // inside the schema, such as resolving paths.
  }
}


const server = await buildServer('path/to/config.json', myPlugin)

await server.start()

const res = await fetch(server.listeningOrigin)
console.log(await res.json())

// do something

await service.close()
```

### Using `beforePlugins` Option

If you want to provide functionality _before_ the plugins are loaded, but after metrics and telemetry are in place,
you can use the `beforePlugins` option:

```js title="Example Plugin"
async function myPlugin (app, opts) {
  await app.register(platformaticService, {
    ...opts,
    beforePlugins: [async function (app) {
      app.decorate('myvalue', 42)
    }]
  })
}
```

## TypeScript Support

To ensure this module works in a TypeScript setup (outside an application created with `wattpm create`), you need to add the following to your types:

### Type Declarations 

```ts
import { FastifyInstance } from 'fastify'
import { PlatformaticApp, PlatformaticServiceConfig } from '@platformatic/service'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticServiceConfig>
  }
}
```

### Usage Example 

```ts
/// <reference path="./global.d.ts" />
import { FastifyInstance } from 'fastify'

export default async function (app: FastifyInstance) {
  app.get('/', async () => {
    return app.platformatic.config
  })
}
```

You can always generate a file called `global.d.ts` with the above content via the `platformatic service types` command.

## Usage with Custom Configuration

If you are creating a reusable application on top of Platformatic Service, you would need to create the types for your schema, 
using [json-schema-to-typescript](https://www.npmjs.com/package/json-schema-to-typescript) in a `./config.d.ts` file and
use it like this:

### Custom Configuration Types

```ts
import { FastifyInstance } from 'fastify'
import { PlatformaticApp } from '@platformatic/service'
import { YourApp } from './config'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<YourApp>
  }
}
```
:::note
You can construct `platformatic` like any other union types, adding other definitions.
:::

## Writing a Custom Stackable with TypeScript

Creating a reusable application with TypeScript requires a bit of setup. First, create a `schema.ts` file that generates the JSON Schema for your application.

### Schema Definition

```ts
import { schema as serviceSchema } from '@platformatic/service'
import esMain from 'es-main'

const baseSchema = serviceSchema.schema

export const schema = structuredClone(baseSchema)

schema.$id = 'https://raw.githubusercontent.com/platformatic/acme-base/main/schemas/1.json'
schema.title = 'Acme Base'

// Needed to specify the extended module 
schema.properties.extends = {
  type: 'string'
}

schema.properties.dynamite = {
  anyOf: [{
    type: 'boolean'
  }, {
    type: 'string'
  }],
  description: 'Enable /dynamite route'
}

delete schema.properties.plugins

if (esMain(import.meta)) {
  console.log(JSON.stringify(schema, null, 2))
}
```

#### Generate Matching Types 

Use [json-schema-to-typescript](http://npm.im/json-schema-to-typescript) to generate types:

1. `tsc && node dist/lib/schema.js > schemas/acme.json`
2. `json2ts < schemas/acme.json > src/lib/config.d.ts`

Finally, you can write the actual reusable application:

```ts
import fp from 'fastify-plugin'
import { platformaticService, buildServer as buildServiceServer, Stackable, PlatformaticServiceConfig } from '@platformatic/service'
import { schema } from './schema.js'
import { FastifyInstance } from 'fastify'
import type { ConfigManager } from '@platformatic/config'
import type { AcmeBase as AcmeBaseConfig } from './config.js'
import { readFileSync } from 'node:fs'

export interface AcmeBaseMixin {
  platformatic: {
    configManager: ConfigManager<AcmeBaseConfig>,
    config: AcmeBaseConfig
  }
}

async function isDirectory (path: string) {
  try {
    return (await lstat(path)).isDirectory()
  } catch {
    return false
  }
}

function buildStackable () : Stackable<AcmeBaseConfig> {
  async function acmeBase (_app: FastifyInstance, opts: object) {
    // Needed to avoid declaration mergin and be compatibile with the
    // Fastify types
    const app = _app as FastifyInstance & AcmeBaseMixin

    await app.register(platformaticService, opts)
  }

  // break Fastify encapsulation
  fp(acmeBase)

  acmeBase.configType = 'acmeBase'

  // This is the schema for this reusable application configuration file,
  // customize at will but retain the base properties of the schema from
  // @platformatic/service
  acmeBase.schema = schema

  // The configuration of the ConfigManager
  acmeBase.configManagerConfig = {
    schema,
    version: require('./package.json').version
    //// use the following if the file is compiled as ESM:
    // version: JSON.parse(readFileSync(new URL(import.meta.url, 'package.json'), 'utf-8')).version
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false
    },
    async transformConfig (this: ConfigManager<AcmeBaseConfig & PlatformaticServiceConfig>) {
      // Call the transformConfig method from the base stackable
      platformaticService.configManagerConfig.transformConfig.call(this)

      // In this method you can alter the configuration before the application
      // is started. It's useful to apply some defaults that cannot be derived
      // inside the schema, such as resolving paths.
    }
  }

  return acmeBase
}

export const acmeBase = buildStackable()

export default acmeBase

export async function buildServer (opts: object) {
  return buildServiceServer(opts, acmeBase)
}
```

## Implementing Auto-Upgrade of the Configuration

Platformatic support auto-upgrading the configuration of your stackable to the latest version. This enables
the use of compatibility options to turn on and off individual features. Imagine that you want to change the
default behavior of your stackable: you can add a configuration option to set the _previous_ behavior.
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

### Wiring it to the stackable

Add a `version` string, specified in your `package.json` and `upgrade` function to your `configManagerConfig`:

```javascript
const { join } = require('path')
const pkg = require('../package.json')

async function upgrade (config, version) {
  const { semgrator } = await import('semgrator')

  const iterator = semgrator({
    version,
    path: join(__dirname, 'versions'),
    input: config,
    logger: this.logger
  })

  let result

  for await (const updated of iterator) {
    // You can add a console.log here to know what is updated
    result = updated.result
  }

  return result
}

stackable.configManagerConfig = {
  ...
  version: require('./package.json'),
  upgrade
}
```
