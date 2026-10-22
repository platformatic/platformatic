---
title: Overview
label: Lavoratore
---

import SharedOverview from '../node/_shared-overview.md';

# Platformatic Lavoratore

Platformatic Lavoratore runs a Worker, an application exporting `fetch` and `scheduled` handlers, as a Platformatic Runtime application. It is compatible with the ES modules handler interface and the Wrangler configuration of [Cloudflare Workers](https://developers.cloudflare.com/workers/):

```js
export default {
  async fetch (request, env, ctx) {
    return Response.json({ hello: env.GREETING })
  },

  async scheduled (controller, env, ctx) {
    console.log(`Cron ${controller.cron} fired`)
  }
}
```

Class based Workers extending `WorkerEntrypoint` from `cloudflare:workers` are supported too.

The Worker runs inside the Watt worker thread, on Node.js. Incoming requests are converted to Fetch API `Request` objects and handed to the `fetch` handler, with no additional processes or network hops. Node.js APIs and the Platformatic globals are available to the Worker.

KV, D1, R2, Durable Objects and Queues bindings are not supported.

## Getting Started

Create or copy a Worker inside the `applications`, `services`, or `web` folder. If you are not using [`autoload`](../runtime/configuration.md#autoload), you also need to explicitly add the new application.

Applications having `wrangler` as a dependency are automatically detected. Otherwise, set `"module": "@platformatic/lavoratore"` (or the `$schema` below) in the application configuration file.

You are all set: start your runtime as usual via `wattpm dev` or `wattpm start`.

## Install

```bash
npm install @platformatic/lavoratore
```

## Example configuration file

Create a `watt.json` in the root folder of your application with the following contents:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/lavoratore/3.74.0.json",
  "lavoratore": {
    "environment": "staging"
  }
}
```

## Entrypoint

The Worker entrypoint is, in order of precedence:

1. `lavoratore.main` in the application configuration file.
2. `main` in the Wrangler configuration file.
3. `main` in `package.json`.
4. The first existing file among `src/index`, `src/worker`, `index` and `worker`, with the `.js`, `.mjs`, `.ts` or `.mts` extension.

## Wrangler configuration

A [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/) (`wrangler.json`, `wrangler.jsonc` or `wrangler.toml`) is optional. Everything it provides can also be set in the application configuration file, whose values take precedence. When present, the following properties are supported:

- `main`
- `vars`
- `triggers.crons`
- `services`
- `env`, selected via `lavoratore.environment`

Other properties, including the KV, D1, R2, Durable Objects and Queues bindings, are ignored.

In development, local secrets are loaded from `.dev.vars` (or `.dev.vars.<environment>`), as in Wrangler.

## Integrating with other Watt applications

Service bindings map a binding name to a Watt application. The following configuration makes `env.API.fetch()` reach the `api` application through the mesh network:

```json
{
  "lavoratore": {
    "services": { "API": "api" }
  }
}
```

Wrangler [service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) are supported too, mapping `service` to the Watt application with the same ID:

```json
{
  "services": [{ "binding": "API", "service": "api" }]
}
```

The Worker can also call other applications directly with `fetch('http://api.plt.local/path')`.

## Cron triggers

Cron triggers defined in `triggers.crons` (or `lavoratore.crons`) are registered in the Watt [scheduler](../../guides/scheduler.md) and invoke the Worker `scheduled` handler.

## TypeScript

TypeScript entrypoints are executed using Node.js [type stripping](https://nodejs.org/api/typescript.html#type-stripping). If the Worker uses TypeScript features which cannot be stripped, compile it with `application.commands.build` and point `lavoratore.main` to the output.

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
