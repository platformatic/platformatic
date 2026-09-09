---
title: Migrate from Fastify
label: From Fastify
---

# Migrate a Fastify Application to Watt

Fastify applications have the shortest path into Watt of any framework, because Watt is built on
Fastify. Your plugins, decorators, hooks, schemas, and `@fastify/*` packages all keep working
untouched — the only things that change are who calls `listen()` and where the logger comes from.

This guide moves an existing Fastify service into Watt in stages. Each stage leaves you with a
working application.

## The application we are starting from

```js
// index.js
import fastify from 'fastify'

const app = fastify({ logger: true })

app.get('/health', async () => {
  return { status: 'ok' }
})

app.get('/orders/:id', async request => {
  return { id: request.params.id, total: 42 }
})

await app.listen({ port: process.env.PORT ?? 3000 })
```

## Stage 1: Wrap it, change nothing

From the root of your existing project:

```bash
npm create wattpm
```

It detects the existing application and offers to wrap it:

```
Hello YOURNAME, welcome to Watt!
? This folder seems to already contain a Node.js application. Do you want to wrap into Watt? yes
INFO: watt.config.mjs written!
INFO: You are all set! Run `npm start` to start your project.
```

```bash
npx wattpm dev
```

Your `listen()` call still runs and Watt adopts the server it created. Routes behave identically, and
you immediately get Watt's structured logging, metrics, health probes, and management API.

This stage is worth doing on its own if all you want is the operational surface. Everything below is
about integrating more deeply.

## Stage 2: Export the app instead of listening

Hand the server to Watt by exporting a `build` function and removing the `listen` call:

```js
// index.js
import fastify from 'fastify'

export function build () {
  const app = fastify({ logger: true })

  app.get('/health', async () => {
    return { status: 'ok' }
  })

  app.get('/orders/:id', async request => {
    return { id: request.params.id, total: 42 }
  })

  return app
}
```

Return the Fastify instance. Do not call `listen()`, and do not call `ready()` — Watt handles both.

If your application is already structured as `app.js` (builds and returns the instance) plus
`server.js` (calls `listen`), which is the layout `fastify-cli` and the
[Fastify demo](https://github.com/fastify/demo) use, then you already have this. Point Watt at your
`app.js` and delete `server.js` from the startup path.

What changes as a result:

- Only the entrypoint opens a TCP socket. Other applications are reached over the
  [mesh](../../concepts/multithread-model.md).
- Watt starts and stops your application in dependency order, closing it gracefully.
- Crashes and unhealthy workers are supervised — see
  [Application Lifecycle](../../concepts/application-lifecycle.md).

Both `build` and `create` are recognised as the export name.

## Stage 3: Use the runtime logger

Replace `logger: true` with the runtime's logger instance so that your application's logs join the
same stream as every other application's:

```js
import { getLogger } from '@platformatic/globals'
import fastify from 'fastify'

export function build () {
  const app = fastify({ loggerInstance: getLogger() })

  app.get('/orders/:id', async request => {
    request.log.info({ id: request.params.id }, 'fetching order')
    return { id: request.params.id, total: 42 }
  })

  return app
}
```

Note `loggerInstance`, not `logger` — Fastify accepts an existing logger object under that option,
while `logger` takes configuration. `getLogger()` returns a Pino instance, which is what Fastify uses
natively, so `request.log`, `app.log`, child loggers, and serializers all behave as they always did.

Log lines now carry the application id and worker index:

```json
{"level":30,"name":"orders","worker":0,"reqId":"req-1","msg":"fetching order"}
```

Fastify's automatic request logging still applies, so you get `incoming request` and
`request completed` lines per route without configuring anything.

Configuration — levels, redaction, transports, shipping to Elasticsearch or an OTLP collector — moves
to the runtime, where it applies to every application at once. See [Logging](../../guides/logging.md).

## Stage 4: Split into multiple applications

Move each Fastify service into its own directory under `web/`:

```
my-project/
├── package.json          # "workspaces": ["web/*"]
├── watt.config.ts        # runtime configuration
└── web/
    ├── gateway/
    │   ├── package.json
    │   └── watt.config.ts
    └── orders/
        ├── package.json
        ├── watt.config.ts
        └── index.js
```

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  autoload: { path: 'web' },
  logger: { level: 'info' }
})
```

There is no `entrypoint` and no root `server`: each application declares its own port, and the one
that is publicly addressable is the one you point traffic at. Each Fastify application declares the
Node.js capability:

```ts config
import { node } from '@platformatic/node'

export default node({
  server: { port: Number(process.env.PORT ?? 3042) }
})
```

Applications reach each other by id:

```js
const response = await fetch('http://inventory.plt.local/stock/42')
const { available } = await response.json()
```

This is the same `fetch` you would use against a remote service, so extracting an application into
its own deployment later is a hostname change rather than a rewrite. See
[The Modular Monolith](../../concepts/modular-monolith.md).

:::note
Watt starts applications in dependency order. A gateway automatically declares the applications it
composes as its dependencies, so `orders` is fully started before `gateway` begins — you will see
exactly that ordering in the startup logs, without configuring anything.
:::

## Putting an application behind a gateway

Declare the prefix on the application:

```ts config
import { node } from '@platformatic/node'

export default node({
  application: { basePath: '/orders' },
  server: { port: Number(process.env.PORT ?? 3042) }
})
```

and list it in the gateway:

```ts config
import { gateway } from '@platformatic/gateway'

export default gateway({
  gateway: {
    applications: [{ id: 'orders' }],
    refreshTimeout: 1000
  },
  server: { port: Number(process.env.PORT ?? 3042) }
})
```

:::caution[The prefix is stripped before your application sees it]

By default the gateway removes the prefix. `GET /orders/health` arrives at your Fastify app as
`GET /health`.

For a migration this is exactly right — **your existing routes keep working unchanged**. Do not
re-register them under the prefix. If you do, Fastify will report:

```json
{"message":"Route GET:/health not found","error":"Not Found","statusCode":404}
```

which is the giveaway that the app is looking for a prefixed route while the gateway has already
removed the prefix.

If the application needs the full path — it builds absolute URLs, or serves an OpenAPI document whose
paths must match what clients see — set `absoluteUrl` and register routes under the base path:

```ts config
import { node } from '@platformatic/node'

export default node({
  application: { basePath: '/orders' },
  node: { absoluteUrl: true },
  server: { port: Number(process.env.PORT ?? 3042) }
})
```

```js
import { getBasePath } from '@platformatic/globals'

export function build () {
  const app = fastify({ loggerInstance: getLogger() })
  const prefix = getBasePath({ throwOnMissing: false }) ?? ''

  app.register(
    async instance => {
      instance.get('/health', async () => ({ status: 'ok' }))
      instance.get('/:id', async request => ({ id: request.params.id, total: 42 }))
    },
    { prefix }
  )

  return app
}
```

Fastify's `register` with a `prefix` is the natural fit here — it applies the base path to a whole
plugin without touching individual route definitions.
:::

## Exposing your OpenAPI schema to the gateway

If you use `@fastify/swagger`, publishing the schema lets the gateway compose your routes into a
unified API rather than just proxying them:

```js
import { getLogger, setOpenapiSchema } from '@platformatic/globals'
import fastifySwagger from '@fastify/swagger'
import fastify from 'fastify'

export async function build () {
  const app = fastify({ loggerInstance: getLogger() })

  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: { title: 'Orders API', version: '1.0.0' }
    }
  })

  app.addHook('onReady', async () => {
    setOpenapiSchema(app.swagger())
  })

  return app
}
```

See [API modification](../../reference/gateway/api-modification.md) for what the gateway can do once
it has the schema.

## What carries over unchanged

Worth stating explicitly, because it is most of your codebase:

- Every `@fastify/*` plugin — `@fastify/cors`, `@fastify/jwt`, `@fastify/helmet`, and the rest
- Your own plugins, decorators, and hooks
- JSON Schema validation and serialization
- `fastify-plugin` and the encapsulation model
- Error handlers, `setErrorHandler`, `setNotFoundHandler`
- `app.inject()` in your tests — your existing test suite needs no changes if it builds the app and
  injects into it

## Things that catch people out

- **`logger: true` versus `loggerInstance`.** Passing `logger: true` gives you a second, separate
  logger writing its own stream. Use `loggerInstance: getLogger()`.
- **Do not call `listen()` or `ready()`** once you export `build`. Watt does both.
- **`process.env.PORT` is not consulted.** The entrypoint's port comes from `server.port` in the
  runtime configuration; other applications normally have no port.
- **In-memory state is per worker.** Multiple workers means multiple heaps — caches and counters need
  a shared store. See [The Multithread Model](../../concepts/multithread-model.md).
- **`process.exit()` kills the whole runtime**, not just your application.
- **`process.cwd()` is the runtime root.** Resolve paths from `import.meta.dirname`.

## Related reading

- [Migrate from Express](./from-express.md) — the same journey, Express specifics
- [Running Your Project in Watt](../../getting-started/port-your-app.md) — the short version
- [Node.js capability reference](../../reference/node/overview.md) — `build`/`create`, `absoluteUrl`, OpenAPI
- [Application Lifecycle](../../concepts/application-lifecycle.md) — startup ordering and supervision
- [API Gateway](../../reference/gateway/overview.md) — composing applications
