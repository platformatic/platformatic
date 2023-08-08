# Packaging a Platformatic Application as a module

[Platformatic Service](/docs/reference/db/introduction.md) and [Platformatic DB](/docs/reference/db/introduction.md)
offer a good starting point to create new applications. However, most developers or organizations might want to
create reusable services or applications built on top of Platformatic.
This is useful to publish the application on the public npm registry (or a private one!), including building your own CLI,
or to create a specialized template for your organization to allow for centralized bugfixes and updates.

This process is the same one we use to maintain Platformatic DB and Platformatic Composer on top of Platformatic Service.

## Creating a custom Service

We are creating the module `foo.js` as follows: 

```js
const { schema, platformaticService } = require('@platformatic/service')

/**  @type {import('fastify').FastifyPluginAsync<{}>} */
async function foo (app, opts) {
  const text = app.platformatic.config.foo.text
  app.get('/foo', async (request, reply) => {
    return text
  })

  await platformaticService(app, opts)
}

foo.configType = 'foo'

// break Fastify encapsulation
foo[Symbol.for('skip-override')] = true

// The schema for our configuration file
foo.schema = {
  $id: 'https://example.com/schemas/foo.json',
  title: 'Foo Service',
  type: 'object',
  properties: {
    server: schema.server,
    plugins: schema.plugins,
    metrics: schema.metrics,
    watch: {
      anyOf: [schema.watch, {
        type: 'boolean'
      }, {
        type: 'string'
      }]
    },
    $schema: {
      type: 'string'
    },
    module: {
      type: 'string'
    },
    foo: {
      type: 'object',
      properties: {
        text: {
          type: 'string'
        }
      },
      required: ['text']
    }
  },
  additionalProperties: false,
  required: ['server']
}

// The configuration for the ConfigManager
foo.configManagerConfig = {
  schema: foo.schema,
  envWhitelist: ['PORT', 'HOSTNAME'],
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  }
}

module.exports = foo
```

Note that the `$id` property of the schema identifies the module in our system,
allowing us to retrieve the schema correctly.
It is recommended, but not required, that the JSON schema is actually
published in this location. Doing so allows tooling such as the VSCode
language server to provide autocompletion.

In this example, the `schema` adds a custom top-level `foo` property
that users can use to configure this specific module.

ESM is also supported.

## Consuming a custom application

Consuming `foo.js` is simple. We can create a `platformatic.json` file as follows:

```json
{
  "$schema": "https://example.com/schemas/foo.json",
  "module": "./foo",
  "server": {
    "port": 0,
    "hostname": "127.0.0.1"
  },
  "foo": {
    "text": "Hello World"
  }
}
```

Note that we __must__ specify both the `$schema` property and `module`.
Module can also be any modules published on npm and installed via your package manager.

## Building your own CLI

It is possible to build your own CLI with the following `cli.mjs` file:

```
import foo from './foo.js'
import { start } from '@platformatic/service'
import { printAndExitLoadConfigError } from '@platformatic/config'

await start(foo, process.argv.splice(2)).catch(printConfigValidationErrors)
```

This will also load `platformatic.foo.json` files.
