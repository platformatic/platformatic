---
title: Overview
label: Astro
---

import Issues from '../../getting-started/issues.md';

# Platformatic Node

The Platformatic Node allows to run a [Fastify](https://fastify.io/), [Express](https://expressjs.com/), [Koa](https://koajs.com/#) or plain Node application as a Platformatic Runtime service with no modifications.

## Getting Started

Create or copy your application inside the `web` or `services` folder. If you are not using [`autoload`](../../runtime/configuration.md#autoload), you also have to explictly add the new service.

You are all set, you can now start your runtime as usual via `wattpm dev` or `plt start`.

## Example configuration file

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/2.0.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Architecture

If your server entrypoint exports a `create` or `build` function, then Platformatic Node will execute it and then will wait for it to return a server object. In this situation the server will be used without starting a TCP server. The TCP server is started if the service is the runtime entrypoint.

If your server entrypoint does not export a function, then Platformatic runtime will execute the function and wait for a TCP server to be started.

In both cases, the listening port is always modified and chosen randomly, overriding any user or application setting.

If the service uses the `commands` property then it's always responsible to start a HTTP server and the `create` or `build` functions are not supported anymore.

In all cases, Platformatic runtime will modify the server port replacing it with a random port and then it will integrate the external service in the runtime.

## Example services entrypoints

### Fastify with build function

```js
import fastify from 'fastify'

export function create() {
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

## API

- **`platformatic.setBasePath(path)`**: This function can be use to override the base path for the service. If not properly configure in the composer, this can make your application unaccessible.
- **`platformatic.serviceId`**: The id of the service.
- **`platformatic.workerId`**: The id of the service worker.
- **`platformatic.root`**: The root directory of the service.
- **`platformatic.basePath`**: The base path of the service in the composer.
- **`platformatic.logLevel`**: The log level configured for the service.
- **`platformatic.events.on('close')`**: This event is emitted when the process is being closed. A listener should be installed to perform a graceful close, which must finish in 10 seconds. If there is no listener, the process will be terminated by invoking `process.exit(0)`.

<Issues />