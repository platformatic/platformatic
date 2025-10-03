---
title: Overview
label: Node.js
---

import SharedOverview from './\_shared-overview.md';

# Platformatic Node

The Platformatic Node allows to run a [Fastify](https://fastify.io/), [Express](https://expressjs.com/), [Koa](https://koajs.com/#) or plain Node application as a Platformatic Runtime application with no modifications.

## Getting Started

Create or copy your application inside the `applications`, `services` or `web` folder. If you are not using [`autoload`](../runtime/configuration.md#autoload), you also have to explictly add the new application.

You are all set, you can now start your runtime as usual via `wattpm dev` or `wattpm start`.

## Install

```bash
npm install @platformatic/node
```

## Example configuration file

Create a `watt.json` in the root folder of your application with the following contents:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/2.0.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Specify application info

Some info can be specified for the node applications. Currently for this few lines of code must be added.

### OpenAPI and GraphQL schema

It's possible for the node applications to expose the OpenAPI or GraphQL schemas, if any.
This can be done adding few lines of code, e.g. for fastify:

```javascript
import fastify from 'fastify'
import fastifySwagger from '@fastify/swagger'

export async function build () {

  const server = fastify({
    loggerInstance: globalThis.platformatic?.logger
  })

  await server.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Test Fastify API',
        description: 'Testing the Fastify swagger API',
        version: '0.1.0'
      },
     }
  })

  server.addHook('onReady', async () => {
    const schema = server.swagger()
    globalThis.platformatic.setOpenapiSchema(schema)
  })
```

### Connection String

It's possible to specify if a node application uses a connection string (and which one).
This is useful to map which application uses which database and to potentialy track database changes.

```javascript
import { createServer } from 'node:http'

globalThis.platformatic.setConnectionString('postgres://dbuser:dbpass@mydbhost/apidb')

const server = createServer((_req, res) => {
  res.end(JSON.stringify({ ok: true }))
})

server.listen(1)
```

## Architecture

If your server entrypoint exports a `create` function, then Platformatic Node will execute it and then will wait for it to return a server object. In this situation the server will be used without starting a TCP server. The TCP server is started if the application is the runtime entrypoint.

If your server entrypoint does not export a function, then Platformatic runtime will execute the function and wait for a TCP server to be started.

In both cases, the listening port is always modified and chosen randomly, overriding any user or application setting.

If the application uses the `commands` property then it's always responsible to start a HTTP server and the `create` functions are not supported anymore.

In all cases, Platformatic runtime will modify the server port replacing it with a random port and then it will integrate the external application in the runtime.

If your application entrypoint exports a `hasServer` variable set to `false`, then Platformatic Node will treat the application as a background application which doesn't expose any HTTP port. Alternatively, you can set the `node.hasServer` property to false in your `watt.json` file.
To gracefully shut down an application with `hasServer=false`, you may export a `close` function that will be called upon application shutdown.

## Example applications entrypoints

### Fastify with build function

```js
import fastify from 'fastify'

export function create () {
  const app = fastify({
    logger: { level: globalThis.platformatic?.logLevel ?? 'info' }
  })

  const prefix = globalThis.platformatic?.basePath ?? ''

  app.get(`${prefix}/env`, async () => {
    return { production: process.env.NODE_ENV === 'production' }
  })

  return app
}
```

### Express with no build function

```js
import express from 'express'

const app = express()

const prefix = globalThis.platformatic?.basePath ?? ''

app.get(`${prefix}/env`, (req, res) => {
  res.send({ production: process.env.NODE_ENV === 'production' })
})

app.listen(3000)
```

### Background only application

```js
export const hasServer = false

globalThis.platformatic.messaging.handle('ping', () => 'pong')

const timeoutId = setTimeout(() => console.log('done'), 10_000)

// Optionally provide a close function
export async function close() {
  clearTimeout(timeoutId)
}
```

### Typescript

The Platformatic Node allows to run Typescript application with the use of custom commands via the `commands` property.

To make Typescript work in development mode, setup a `commands.development` value which will start Node.js with a TypeScript loader.

When configuring production mode instead, you have to configure both the `commands.build` and `commands.production` values. The former will be used to compile your application, while the latter will be used to start it.

A complete typical setup for the application `watt.json` file will be something like this:

```
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/2.9.1.json",
  "application": {
    "commands": {
      "development": "node --import tsx server.ts",
      "build": "tsc",
      "production": "node dist/server.js"
    }
  }
}
```

Watt supports setting up `npm run ...` commands so you can reuse your existing npm scripts flow.

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
