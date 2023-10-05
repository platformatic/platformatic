# Programmatic API

In many cases it's useful to start Platformatic Service using an API instead of
command line, e.g. in tests we want to start and stop our server.

The `buildServer` function allows that:

```js
import { buildServer } from '@platformatic/service'

const app = await buildServer('path/to/platformatic.service.json')

await app.start()

const res = await fetch(app.url)
console.log(await res.json())

// do something

await app.close()
```

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

## Creating a reusable application on top of Platformatic Service

[Platformatic DB](/reference/db/introduction.md) is built on top of Platformatic Serivce.
If you want to build a similar kind of tool, follow this example:

```js
import { buildServer, schema } from '@platformatic/service'

async function myPlugin (app, opts) {
  // app.platformatic.configManager contains an instance of the ConfigManager
  console.log(app.platformatic.configManager.current)

  await platformaticService(app, opts)
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
  schema: foo.schema,
  envWhitelist: ['PORT', 'HOSTNAME'],
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

## TypeScript support


In order for this module to work on a TypeScript setup (outside of an application created with `create-platformatic`),
you have to add the following to your types:

```ts
import { FastifyInstance } from 'fastify'
import { PlatformaticApp, PlatformaticServiceConfig } from '@platformatic/service'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticServiceConfig>
  }
}
```

Then, you can use it:

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


### Usage with custom configuration

If you are creating a reusable application on top of Platformatic Service, you would need to create the types for your schema, 
using [json-schema-to-typescript](https://www.npmjs.com/package/json-schema-to-typescript) in a `./config.d.ts` file and
use it like so:

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

Note that you can construct `platformatic` like any other union types, adding other definitions.

## Writing a custom Stackable with TypeScript

Creating a reusable application with TypeScript requires a bit of setup.
First, create a `schema.ts` file that generates the JSON Schema for your your application. Like so:

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

Then generates the matching types with [json-schema-to-typescript](http://npm.im/json-schema-to-typescript):

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

    await platformaticService(app, opts)
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
    envWhitelist: ['PORT', 'HOSTNAME', 'WATCH'],
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
