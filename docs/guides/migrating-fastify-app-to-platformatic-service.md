# Migrating a Fastify app to Platformatic Service

## Introduction

Building production ready Node.js application with Fastify can require a certain amount of boilerplate code. This is a side effect of some of Fastify's technical principles:

- **If it can be a plugin, it should be a plugin** — [Plugins](https://www.fastify.io/docs/latest/Reference/Plugins/) help with the separation of concerns, they improve testability, and also provide a way to logically organise and structure your applications.
- **Developer choice = developer freedom** — Fastify only applies a few strong opinions, in key areas such as logging and validation. The framework features have been designed to give you the freedom to build your applications however you want.
- **You know your needs best** — Fastify doesn't make assumptions about what plugins you'll need in your application. As the Fastify [plugin ecosystem](https://www.fastify.io/ecosystem/) and the community has grown, a clear group of popular plugin choices has emerged.

[Platformatic Service](/docs/reference/service/introduction) is the natural evolution of the build-it-from-scratch Fastify development experience. It provides a solid foundation for building Node.js applications on top of Fastify, with best practices baked in.

> See the [Building apps with Platformatic Service](#building-apps-with-platformatic-service) section of this guide to learn more about the built-in features.

The good news is that the path to migrate a Fastify application to use Platformatic Service is fairly straightforward. This guide covers some of the things you'll need to know when migrating an application, as well as tips on different migration approaches.

This guide assumes that you have some experience building applications with the [Fastify](https://www.fastify.io/) framework. If you'd like to learn more about about building web applications with Fastify, we recommend taking a look at:

- The [Fastify Getting Started guide](https://www.fastify.io/docs/latest/Guides/Getting-Started/).
- The [Building a modular monolith with Fastify](https://www.youtube.com/watch?v=e1jkA-ee_aY) talk by Fastify co-creator and Platformatic co-founder, [Matteo Collina](https://twitter.com/matteocollina).
- The new [Accelerating Server-Side Development with Fastify](https://packt.link/DvIDB) book.

## Example Fastify application

For the purpose of this guide, we have a basic example Fastify application. Although this app has a specific structure, the migration steps covered in this guide can generally be applied to any Fastify application.

> The code for the example Fastify and migrated Platformatic Service applications is available [on GitHub](https://github.com/platformatic/examples/blob/main/applications/migrate-fastify-app-to-platformatic-service/).

Here's the structure of the example Fastify application:

```
├── app.js
├── package.json
├── plugins
│   └── data-source.js
├── routes
│   ├── movies.js
│   └── quotes.js
├── server.js
└── test
    └── routes.test.js
```

It has the following dependencies:

```json
// package.json

"dependencies": {
  "fastify": "^4.17.0",
  "fastify-plugin": "^4.5.0"
}
```

The application has a plugin that decorates the Fastify server instance, as well as two Fastify plugins which define API routes. Here's the code for them:

```javascript
// plugins/data-source.js

import fastifyPlugin from 'fastify-plugin'

/** @param {import('fastify').FastifyInstance} app */
async function dataSource (app) {
  app.decorate('movies', [
    'Jaws',
    'Star Wars',
    'The Wizard of Oz'
  ])

  app.decorate('quotes', [
    'You\'re gonna need a bigger boat.',
    'May the Force be with you.',
    'Toto, I\'ve got a feeling we\'re not in Kansas anymore.'
  ])
}

export default fastifyPlugin(dataSource)
```

> [`fastify-plugin`](https://www.npmjs.com/package/fastify-plugin) is used to to prevent Fastify from creating a new encapsulation context for the plugin. This makes the decorators that are registered in the `dataSource` plugin available in the route plugins. You can learn about this fundamental Fastify concept in the Fastify [Encapsulation](https://www.fastify.io/docs/latest/Reference/Encapsulation/) documentation.

```javascript
// routes/movies.js

/** @param {import('fastify').FastifyInstance} app */
export default async function movieRoutes (app) {
  app.get('/', async (request, reply) => {
    return app.movies
  })
}
```

```javascript
// routes/quotes.js

/** @param {import('fastify').FastifyInstance} app */
export default async function quotesRoutes (app) {
  app.get('/', async (request, reply) => {
    return app.quotes
  })
}
```

> The route plugins aren't registering anything that needs to be available in other plugins. They have their own encapsulation context and don't need to be wrapped with `fastify-plugin`.

There's also a `buildApp()` factory function in `app.js`, which takes care of creating a new Fastify server instance and registering the plugins and routes:

```javascript
// app.js

import fastify from 'fastify'

export async function buildApp (options = {}) {
  const app = fastify(options)

  app.register(import('./plugins/data-source.js'))

  app.register(import('./routes/movies.js'), { prefix: '/movies' })
  app.register(import('./routes/quotes.js'), { prefix: '/quotes' })

  return app
}
```

And `server.js`, which calls the `buildApp` function to create a new Fastify server, and then starts it listening:

```javascript
// server.js

import { buildApp } from './app.js'

const port = process.env.PORT || 3042
const host = process.env.HOST || '127.0.0.1'

const options = {
  logger: {
    level: 'info'
  }
}

const app = await buildApp(options)

await app.listen({ port, host })
```

As well as a couple of tests for the API routes:

```javascript
// tests/routes.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildApp } from '../app.js'

test('Basic API', async (t) => {
  const app = await buildApp()

  t.after(async () => {
    await app.close()
  })

  await t.test('GET request to /movies route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/movies'
    })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), [
      'Jaws',
      'Star Wars',
      'The Wizard of Oz'
    ])
  })

  await t.test('GET request to /quotes route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/quotes'
    })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), [
      'You\'re gonna need a bigger boat.',
      'May the Force be with you.',
      'Toto, I\'ve got a feeling we\'re not in Kansas anymore.'
    ])
  })
})
```

These tests are using the built in Node.js test runner, [node:test](https://nodejs.org/api/test.html). They can be run with the command: `node --test --test-reporter=spec test/*.test.js`.

> The `@param` lines in this application code are [JSDoc](https://jsdoc.app/) blocks that import the `FastifyInstance` type. This allows many code editors to provide auto-suggest, type hinting and type checking for your code.

## Creating a new Platformatic Service app

To migrate your Fastify app to Platformatic Service, create a new Platformatic Service app with:

```bash
npm create platformatic@latest
```

Be sure to select `Service` as the project type. Once the project has been created, you can delete the example `plugins` and `routes` directories.

### App configuration

The configuration for the Platformatic Service app is stored in `platformatic.service.json`.

The generated configuration is set up to load plugins from the `plugins` and `routes` directories:

```json
// platformatic.service.json

"plugins": {
  "paths": [
    "./plugins",
    "./routes"
  ]
}
```

The value for any configuration setting in `platformatic.service.json` can be replaced with an environment variable by adding a placeholder, for example `{PLT_SERVER_LOGGER_LEVEL}`. In development, environment variables are automatically loaded by your Platformatic Service app from a `.env` file in the root directory of your app. In production, you'll typically set these environment variables using a feature provided by your hosting provider.

See the Platformatic Service documentation for [Environment variable placeholders](/docs/reference/service/configuration#environment-variable-placeholders) to learn more about how this works.

### Using ES modules

If you're using ES modules in the Fastify application code that you'll be migrating, ensure that there's a `type` field in `package.json` set to `module`:

```bash
npm pkg set type=module
```

### Refactoring Fastify server factories

If your Fastify application has a script with a factory function to create and build up a Fastify server instance, you can refactor it into a Fastify plugin and use it in your Platformatic Service app.

Here are a few things to consider while refactoring it:

- Move the options you're passing to Fastify when creating a new server instance to the `server` block in `platformatic.service.json`. These options will be passed through directly by Platformatic Service when it creates a Fastify server instance.
- You can create a root plugin to be loaded by your Platformatic Service app, for example: `export default async function rootPlugin (app, options) { ... }`
- When you copy the code from your factory function into your root plugin, remove the code which is creating the Fastify server instance.
- You can configure your Platformatic Service to load the root plugin, for example:
  ```json
  "plugins": {
    "paths": ["./root-plugin.js"]
  }
  ```
- If you need to pass options to your root plugin, you can do it like this:
  ```json
  "plugins": {
    "paths": [
      {
        "path": "./root-plugin.js",
        "options": {
          "someOption": true
        }
      }
    ]
  }
  ```

## Migrating plugins

Copy over the `plugins` directory from your Fastify app. You shouldn't need to make any modifications for them to work with Platformatic Service.

### Disabling plugin encapsulation

Platformatic Service provides a configuration setting which enables you to disable encapsulation for a plugin, or all the plugins within a directory. This will make any decorators or hooks that you set in those plugins available to all other plugins. This removes the need for you to wrap your plugins with [`fastify-plugin`](https://www.npmjs.com/package/fastify-plugin).

To disable encapsulation for all plugins within the `plugins` directory, you would set your `plugins` configuration like this in `platformatic.service.json`:

```json
// platformatic.service.json

"plugins": {
  "paths": [
    {
        "path": "./plugins",
        "encapsulate": false
    },
    "./routes"
  ]
}
```

> You can learn more about plugin encapsulation in the [Fastify Plugins Guide](https://www.fastify.io/docs/latest/Guides/Plugins-Guide/).

## Migrating routes

Copy over the `routes` directory from your Fastify app.

### Explicit route paths

If you're registering routes in your Fastify application with full paths, for example `/movies`, you won't need to make any changes to your route plugins.

### Route prefixing with file-system based routing

If you're using the `prefix` option when registering route plugins in your Fastify application, for example:

```javascript
app.register(import('./routes/movies.js'), { prefix: '/movies' })
```

You can achieve the same result with Platformatic Service by using file-system based routing. With the following directory and file structure:

```
routes/
├── movies
│   └── index.js
└── quotes
    └── index.js
```

Assuming that both of the route files register a `/` route, these are the route paths that will be registered in your Platformatic Service app:

```
/movies
/quotes
```

With the example Fastify application, this would mean copying the route files over to these places in the Platformatic Service app:

```
routes/movies.js -> routes/movies/index.js
routes/quotes.js -> routes/quotes/index.js
```

> **How does this work?** Plugins are loaded with the [`@fastify/autoload`](https://www.npmjs.com/package/@fastify/autoload) Fastify plugin. The `dirNameRoutePrefix` [plugin option](https://github.com/fastify/fastify-autoload#global-configuration) for `@fastify/autoload` is enabled by default. This means that "routes will be automatically prefixed with the subdirectory name in an autoloaded directory".

If you'd prefer not to use file-system based routing with Platformatic Service, you can add prefixes to the paths for the routes themselves (see [Explicit route paths](#explicit-route-paths)).

### Adapting existing usage of @fastify/autoload

If you're using [`@fastify/autoload`](https://www.npmjs.com/package/@fastify/autoload) in your Fastify application, there are a couple of approaches you can take when migrating the app to Platformatic Service:

- Configure `plugins` in your Platformatic Service app's `platformatic.service.json`. It will then take care of loading your routes and plugins for you with `@fastify/autoload` ([configuration documentation](/docs/reference/service/configuration#plugins)).
- You can continue to use `@fastify/autoload` directly with a little refactoring. See the tips in the [Refactoring Fastify server factories](#refactoring-fastify-server-factories) section.

## Migrating tests

You'll generally use the Platformatic CLI to start your Platformatic Service app (`npx platformatic start`). However for testing, you can use the [programmatic API](/docs/reference/service/programmatic/) provided by Platformatic Service. This allows you to load your app in your test scripts and then run tests against it.

If you copy over the tests from your existing Fastify app, they will typically only require a small amount of refactoring to work with Platformatic Service.

### Replacing your Fastify server factory function

The example Fastify app has a `buildApp()` factory function which creates a Fastify server instance. The `import` line for that function can be removed from `tests/routes.test.js`:

```javascript
// tests/routes.test.js

import { buildApp } from '../app.js'
```

And replaced with an `import` of the `buildServer()` function from `@platformatic/service`:

```javascript
// tests/routes.test.js

import { buildServer } from '@platformatic/service'
```

You can then load your Platformatic Service app like this:

```javascript

const app = await buildServer('./platformatic.service.json')
```

### Disabling server logging in your tests

If you have logged enabled for your Platformatic Service app, you'll probably want to disable the logging in your tests to remove noise from the output that you receive when you run your tests.

Instead of passing the path to your app's configuration to `buildServer()`, you can import the app configuration and disable logging:

```javascript
// tests/routes.test.js

import serviceConfig from '../platformatic.service.json' assert { type: 'json' }

serviceConfig.server.logger = false
```

Then pass that `serviceConfig` configuration object to the `buildServer()` function:

```javascript
// tests/routes.test.js

const app = await buildServer(serviceConfig)
```

> Import assertions — the `assert { type: 'json' }` syntax — are not a stable feature of the JavaScript language, so you'll receive warning messages from Node.js when running your tests. You can disable these warnings by passing the `--no-warnings` flag to `node`.

## Building apps with Platformatic Service

Because Platformatic Service is built on top of the Fastify framework, you're able to use the full functionality of the Fastify framework in your Platformatic Service app. This includes:

- Fast, [structured logging](https://www.fastify.io/docs/latest/Reference/Logging/), provided by [Pino](https://www.npmjs.com/package/pino)
- [Request validation](https://www.fastify.io/docs/latest/Reference/Validation-and-Serialization/#validation-and-serialization) with JSON Schema and Ajv (other validation libraries are supported too)
- [Hooks](https://www.fastify.io/docs/latest/Reference/Hooks/), which allow fine grained control over when code is run during the request/response lifecycle.
- [Decorators](https://www.fastify.io/docs/latest/Reference/Decorators/), which allow you to customize core Fastify objects and write more modular code.

Platformatic Service also provides many other features that are built on top of Fastify.

### Application features

- Metrics with [`fastify-metrics`](https://www.npmjs.com/package/fastify-metrics)
- Healthcheck endpoint with [`@fastify/under-pressure`](https://github.com/fastify/under-pressure)
- OpenAPI specification and Scalar with [`@fastify/swagger`](https://www.npmjs.com/package/@fastify/swagger) and [`@scalar/fastify-api-reference`](https://www.npmjs.com/package/@scalar/fastify-api-reference)
- GraphQL API support with [`mercurius`](https://www.npmjs.com/package/mercurius)
- CORS support with [`@fastify/cors`](https://github.com/fastify/fastify-cors)
- Configuration with environment variable validation

All Platformatic Service features are fully configurable via `platformatic.service.json`.

### Development features

- Hot reloading — Your server will automatically reload in development as you develop features.
- Write your plugins in JavaScript or TypeScript — TypeScript support is provided out-of-the-box and supports hot reloading.
- Pretty printed logs — Making it easier to understand and debug your application during development.

> See the [Platformatic Service Configuration](/docs/reference/service/configuration/) documentation for all of the features which can be configured.

## Next steps

The documentation for [Platformatic Service](/docs/reference/service/introduction) is a helpful reference when building a Platformatic Service app.

### Watch: Understand the parts of a Platformatic app

<iframe class="aspect-ratio-16-9 margin-bottom--md" src="//www.youtube.com/embed/b6G3xZlzJNk" frameborder="0" allowfullscreen=""></iframe>

You want to be confident that you understand how your applications work. In this video you'll learn about the parts that make up a Platformatic application, what each part does, and how they fit together.

Our series of [Platformatic How-to videos](https://www.youtube.com/playlist?list=PL_x4nRdxj60LEXoK5mO-ixOETQTfhqmA7) can help get you up and running building apps with Platformatic open-source tools.

> Got questions or need help migrating your Fastify app to use Platformatic Service? Drop by our [Discord server](https://discord.gg/platformatic) and we'll be happy to help you.