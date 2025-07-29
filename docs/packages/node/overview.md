---
title: Overview
label: Node.js
---

import SharedOverview from './\_shared-overview.md';

# Platformatic Node

The Platformatic Node allows to run a [Fastify](https://fastify.io/), [Express](https://expressjs.com/), [Koa](https://koajs.com/#) or plain Node application as a Platformatic Runtime service with no modifications.

## Getting Started

Create or copy your application inside the `web` or `services` folder. If you are not using [`autoload`](../../runtime/configuration.md#autoload), you also have to explictly add the new service.

You are all set, you can now start your runtime as usual via `wattpm dev` or `wattpm start`.

## Install

```bash
npm install @platformatic/node
```

## Example configuration file

Create a `watt.json` in the root folder of your service with the following contents:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/2.0.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Specify service info

Some info can be specified for the node services. Currently for this few lines of code must be added.

### OpenAPI and GraphQL schema

It's possible for the node services to expose the OpenAPI or GraphQL schemas, if any.
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

It's possible to specify if a node service uses a connection string (and which one).
This is useful to map which service uses which database and to potentialy track database changes.

```javascript
import { createServer } from 'node:http'

globalThis.platformatic.setConnectionString('postgres://dbuser:dbpass@mydbhost/apidb')

const server = createServer((_req, res) => {
  res.end(JSON.stringify({ ok: true }))
})

server.listen(1)
```

## Architecture

If your server entrypoint exports a `create` or `build` function, then Platformatic Node will execute it and then will wait for it to return a server object. In this situation the server will be used without starting a TCP server. The TCP server is started if the service is the runtime entrypoint.

If your server entrypoint does not export a function, then Platformatic runtime will execute the function and wait for a TCP server to be started.

In both cases, the listening port is always modified and chosen randomly, overriding any user or application setting.

If the service uses the `commands` property then it's always responsible to start a HTTP server and the `create` or `build` functions are not supported anymore.

In all cases, Platformatic runtime will modify the server port replacing it with a random port and then it will integrate the external service in the runtime.

If your application entrypoint exports a `hasServer` variable set to `false`, then Platformatic Node will treat the service as a background service which doesn't expose any HTTP port.

## Example services entrypoints

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

### Background only service

```js
export const hasServer = false

globalThis.platformatic.messaging.handle('ping', () => 'pong')
```

### Typescript

The Platformatic Node allows to run Typescript application with the use of custom commands via the `commands` property.

To make Typescript work in development mode, setup a `commands.development` value which will start Node.js with a TypeScript loader.

When configuring production mode instead, you have to configure both the `commands.build` and `commands.production` values. The former will be used to compile your service, while the latter will be used to start it.

A complete typical setup for the service `watt.json` file will be something like this:

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
