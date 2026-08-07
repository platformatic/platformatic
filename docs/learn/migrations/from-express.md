---
title: Migrate from Express
label: From Express
---

# Migrate an Express Application to Watt

This guide takes an existing Express application and moves it into Watt in stages. Each stage is
useful on its own and leaves you with a working application, so you can stop at whichever one gives
you what you need.

| Stage | What you change | What you get |
| --- | --- | --- |
| 1. Wrap | Nothing | Watt logging, metrics, management API, `wattpm` commands |
| 2. Hand over the server | Remove `app.listen`, export `build` | Mesh addressing, coordinated startup and shutdown |
| 3. Split | Move code into multiple applications | Isolation, per-application scaling |

Nothing about your routes, middleware, or error handlers changes at any stage. Express stays Express.

## The application we are starting from

A typical Express service — routes, a `listen` call at the bottom, nothing unusual:

```js
// index.js
import express from 'express'

const app = express()

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Ada Lovelace' })
})

const port = process.env.PORT ?? 3000
app.listen(port, () => {
  console.log(`listening on ${port}`)
})
```

## Stage 1: Wrap it, change nothing

Run the Watt creator from the root of your existing project:

```bash
npm create wattpm
```

It detects that the directory already contains a Node.js application and offers to wrap it:

```
Hello YOURNAME, welcome to Watt!
? This folder seems to already contain a Node.js application. Do you want to wrap into Watt? yes
- Installing @platformatic/runtime using npm ...
INFO: .env written!
INFO: .env.sample written!
INFO: package.json written!
INFO: watt.json written!
INFO: Installing dependencies for the project using npm ...
INFO: You are all set! Run `npm start` to start your project.
```

This writes a `watt.json` that treats your project as a single `@platformatic/node` application:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/3.0.0.json",
  "runtime": {
    "logger": {
      "level": "{PLT_SERVER_LOGGER_LEVEL}"
    },
    "managementApi": "{PLT_MANAGEMENT_API}"
  }
}
```

Start it:

```bash
npx wattpm dev
```

Your `app.listen()` call still runs. Watt notices the server your application started and adopts it:

```
Starting the worker 0 of the application "legacy-express"...
listening on 3000
Started the worker 0 of the application "legacy-express"...
Platformatic is now listening at http://127.0.0.1:3000
```

Your routes work exactly as before, and your `console.log` output is captured into the structured log
stream. You now have Watt's logging, metrics, health probes, and management API without having
touched a line of application code.

:::note
The wrap step does not rewrite your `package.json` `start` script. If it was `node index.js`, it
still is. Change it to `wattpm start` (and add `"dev": "wattpm dev"`) when you want `npm start` to go
through Watt.
:::

## Stage 2: Let Watt own the server

Stage 1 works, but your application is still opening its own TCP socket. Exporting a `build` function
instead hands the server to Watt, which is what unlocks the rest of the platform.

Delete the `listen` call and export the app:

```js
// index.js
import express from 'express'

export function build () {
  const app = express()

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
  })

  app.get('/users/:id', (req, res) => {
    res.json({ id: req.params.id, name: 'Ada Lovelace' })
  })

  return app
}
```

Return the Express app itself — not an `http.Server`. Watt recognises it and wires it up.

What this buys you:

- **No TCP for internal traffic.** Only the entrypoint gets a real socket. Everything else is reached
  over the [mesh](../../concepts/multithread-model.md), which is a message between threads rather
  than a network round trip.
- **Coordinated lifecycle.** Watt starts your application in dependency order and shuts it down
  gracefully rather than pulling the socket out from under in-flight requests.
- **Restarts and health checks.** See [Application Lifecycle](../../concepts/application-lifecycle.md).

The name can be `build` or `create`; both are recognised.

## Stage 3: Use the runtime logger

Your application's own logger still works, but routing it through Watt means every application's logs
land in one stream, already tagged with the application id and worker index:

```js
import { getLogger } from '@platformatic/globals'
import express from 'express'

export function build () {
  const app = express()
  const logger = getLogger()

  app.get('/users/:id', (req, res) => {
    logger.info({ id: req.params.id }, 'fetching user')
    res.json({ id: req.params.id, name: 'Ada Lovelace' })
  })

  return app
}
```

Which produces:

```json
{"level":30,"name":"api","worker":0,"id":"42","msg":"fetching user"}
```

`getLogger()` returns a [Pino](https://getpino.io) logger, so if you were already using Pino the call
signatures are unchanged. See [Logging](../../guides/logging.md) for the full configuration surface.

## Stage 4: Split into multiple applications

This is the stage that pays for the previous ones. Move each Express application into its own
directory under `web/`:

```
my-project/
├── package.json          # "workspaces": ["web/*"]
├── watt.json             # runtime configuration
└── web/
    ├── api/              # the Express application
    │   ├── package.json
    │   ├── watt.json
    │   └── index.js
    └── notifier/
        ├── package.json
        ├── watt.json
        └── index.js
```

The runtime configuration picks up everything under `web/` and names one application as the
entrypoint:

```json
{
  "$schema": "https://schemas.platformatic.dev/wattpm/3.0.0.json",
  "entrypoint": "api",
  "autoload": { "path": "web" },
  "server": { "hostname": "127.0.0.1", "port": 3042 },
  "logger": { "level": "info" }
}
```

Each application gets a minimal `watt.json` naming its capability:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/3.0.0.json"
}
```

Applications call each other over the mesh, using the directory name as the hostname:

```js
app.get('/users/:id', async (req, res) => {
  const response = await fetch(`http://notifier.plt.local/greeting/${req.params.id}`)
  const { greeting } = await response.json()

  res.json({ id: req.params.id, name: 'Ada Lovelace', greeting })
})
```

No port, no service registry, no environment variable holding an address. The application id is the
address.

This is ordinary `fetch` against an ordinary URL, which is the point: if you later extract `notifier`
into its own deployment, this call site changes only in hostname. See
[The Modular Monolith](../../concepts/modular-monolith.md).

## Putting an application behind a gateway

When an Express application is not the entrypoint, it usually sits behind a
[gateway](../../reference/gateway/overview.md) that exposes it under a prefix.

Declare the prefix on the application:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/3.0.0.json",
  "application": {
    "basePath": "/orders"
  }
}
```

and let the gateway pick it up:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/gateway/3.0.0.json",
  "gateway": {
    "applications": [{ "id": "orders" }],
    "refreshTimeout": 1000
  }
}
```

:::caution[The prefix is stripped before your application sees it]

By default the gateway removes the prefix on the way through. A request for `/orders/health` arrives
at your Express app as `/health`.

This is what you want when migrating: **your existing routes keep working unchanged**. Do not add the
prefix to your route definitions — if you register `/orders/health`, the incoming `/health` will not
match it and you will get a 404 that looks like a routing bug.

If your application genuinely needs the full path — because it builds absolute URLs, or generates
links that must include the prefix — set `absoluteUrl` and prefix your routes explicitly:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/3.0.0.json",
  "application": { "basePath": "/orders" },
  "node": { "absoluteUrl": true }
}
```

```js
import { cleanBasePath } from '@platformatic/basic'
import { getBasePath } from '@platformatic/globals'

const prefix = getBasePath({ throwOnMissing: false }) ?? ''

app.get(cleanBasePath(`${prefix}/health`), (req, res) => {
  res.json({ status: 'ok' })
})
```

Pick one mode or the other. Mixing them — `absoluteUrl` off with prefixed routes, or on with
unprefixed routes — produces 404s in both directions.
:::

## Production

```bash
npm run build   # wattpm build
npm run start   # wattpm start
```

`wattpm build` runs each application's build step, if it has one. For a plain Express application
there is usually nothing to build, but running it keeps the command identical across a project that
also contains frontends.

## Things that catch people out

- **`process.env.PORT` no longer decides anything.** Watt assigns ports. The entrypoint's public port
  comes from `server.port` in the runtime configuration; non-entrypoint applications normally have no
  port at all.
- **In-memory state is per worker.** If you give an application multiple workers, each has its own
  heap. Sessions, caches, and rate-limit counters need a shared store — exactly as they would across
  containers. See [The Multithread Model](../../concepts/multithread-model.md).
- **`process.exit()` takes down the whole runtime.** Threads share a process. Throw or return an
  error instead.
- **`process.cwd()` is the runtime root**, not your application directory. Resolve paths relative to
  `import.meta.dirname`.
- **Only the entrypoint is reachable from outside.** This is a feature — a non-entrypoint application
  does not open a listening socket — but it does mean you cannot curl it directly. Use
  `wattpm inject` or route through the gateway.

## Related reading

- [Migrate from Fastify](./from-fastify.md) — the same journey, Fastify specifics
- [Running Your Project in Watt](../../getting-started/port-your-app.md) — the short version
- [Node.js capability reference](../../reference/node/overview.md) — `build`/`create`, `absoluteUrl`, background applications
- [The Modular Monolith](../../concepts/modular-monolith.md) — why splitting this way stays reversible
- [Watt Architecture Patterns](../../guides/watt-architecture-patterns.md) — how to draw the boundaries
