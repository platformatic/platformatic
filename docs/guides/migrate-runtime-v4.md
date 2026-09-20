---
title: Migrate Runtime Configuration to v4
---

# Migrate Runtime Configuration to v4

v4 changes two things about configuration at once, and they are easier to do together than apart:

- **The file is a program.** A project is configured by a `watt.config.ts` that exports its configuration, instead of a `platformatic.runtime.json` interpolated with `{PLT_X}` placeholders. The other three names are `watt.config.mts`, `watt.config.js` and `watt.config.mjs`; which one you write is decided by the package, not by preference (see [Choosing the filename](#choosing-the-filename)).
- **The runtime owns no listener.** `entrypoint` and the root `server` block are gone. Each application declares its own address in its own capability configuration. The runtime observes the servers that listen and reports their URLs; it does not select ports or rewrite listener options.

The two dialects do not mix. A `watt.json` beside a `watt.config.ts` is refused rather than merged, so the switch is per project rather than per file.

## Run the codemod first

```bash
npx wattpm-utils migrate
```

`migrate` reads the v3 configuration, decides every refusal before writing anything, and then writes the v4 files. It converts `{PLT_X}` placeholders to the expressions they stand for, moves the root listener into the capability that owned it, and reports what it could not decide for you. What follows is what it does, so that you can read its output — and do it by hand where you would rather.

**Run it on a clean git tree.** There is no backup file and no `--keep`: version control is the undo mechanism, so review the result with `git diff` and undo it with `git restore` if needed. `migrate` refuses to run on a dirty tree (`--force` overrides, with a loud warning; the same flag is needed for a project with no VCS at all). An untracked or gitignored legacy config file — `platformatic.json` is often gitignored because it carries secrets — counts as dirty too, and blocks the run by name, because deleting a file git never tracked is unrecoverable; commit it or exclude it deliberately first.

Legacy config files are **deleted** once the new ones are written and validated, not merely left in place. If the run is interrupted, `wattpm-utils migrate --resume` continues from where it left off, using a `.wattpm-migrate.json` manifest written for the life of the run (and removed on completion).

## Choosing the filename

`.ts` and `.mts` are TypeScript, stripped by Node itself — types are annotations only, so no `enum`, no `namespace`, no parameter properties. `.js` and `.mjs` are plain JavaScript.

The `m` prefix is not a style choice: a `watt.config.js` in a package without `"type": "module"` is CommonJS, and `export default` there is a syntax error. In a package that declares `"type": "module"`, write `watt.config.ts` or `watt.config.js`; in one that does not, write `watt.config.mts` or `watt.config.mjs`.

One configuration file per directory. Two is an error, not a precedence rule.

## Placeholders become expressions

v3 interpolated `{PLT_X}` into strings and then coerced the result to the schema's type. v4 evaluates a program, so the value is whatever the expression produces and nothing coerces it afterwards.

Before, in `platformatic.runtime.json`:

```json v3
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/3.0.0.json",
  "logger": { "level": "{PLT_SERVER_LOGGER_LEVEL}" },
  "applications": [{ "id": "api", "path": "./api" }]
}
```

After, in `watt.config.ts`:

```ts config env=PLT_SERVER_LOGGER_LEVEL=info
import { createWattConfig } from 'wattpm'

/*
  `level` is a string the schema forbids from being empty — a string so a custom level can name it,
  but never legitimately `''`. A fallback is wrong: `process.env.X ?? ''` would leave the empty
  string a missing variable interpolated to, which the schema rejects, so a missing variable must
  throw instead. This is the helper `migrate` writes into the file for you.
*/
function requiredEnv (name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required.`)
  }

  return value
}

export default createWattConfig({
  logger: {
    level: requiredEnv('PLT_SERVER_LOGGER_LEVEL')
  },
  applications: [{ id: 'api', path: './api' }]
})
```

A missing variable used to interpolate to the empty string. Now it is `undefined`, which is why what replaces a placeholder depends on what the position holds:

- **a string that may be empty** — `process.env.PLT_BASE_PATH ?? ''`
- **a string the schema forbids from being empty** — `requiredEnv(...)` as above, because the empty string a missing variable would leave fails the schema
- **a number** — `Number(process.env.PORT || 3042)`, with `||` rather than `??`, because `PORT=` in an env file supplies the empty string and the empty string is present
- **an enum** — `requiredEnum(name, [...])`, a variant that also checks the value is one of a genuinely closed set, for a capability position that declares one
- **a boolean** — by hand. v3's rules contradicted each other by position, so there is no single conversion to write

`createWattConfig` types the object; it does not transform it. Omitting it is legal and costs you the editor's help.

## Rename tracing configuration and package

Rename the `telemetry` configuration section to `tracing`. The OpenTelemetry integration package is now `@platformatic/tracing` instead of `@platformatic/telemetry`:

```diff
- "telemetry": {
+ "tracing": {
```

Update package imports and dependencies accordingly:

```diff
- import { telemetry } from '@platformatic/telemetry'
+ import { telemetry } from '@platformatic/tracing'
```

## Replace the legacy runtime global

Runtime v4 removes `globalThis.platformatic`. Use the typed APIs from `@platformatic/globals` instead:

```js
import { getApplicationId, getLogger, setBasePath } from '@platformatic/globals'

const applicationId = getApplicationId()
const logger = getLogger()
setBasePath('/api')
```

Runtime API values are no longer exposed on `globalThis.platformatic`: they are kept in an internal, non-enumerable store shared across every copy of `@platformatic/globals` in the process, so the typed getters and setters work regardless of how the package is resolved or bundled.

## Move listener configuration to the capability

Remove `server` and `entrypoint` from the root. Configure the listening address in the configuration file of the application that owns the HTTP endpoint.

Before:

```json v3
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/runtime/3.0.0.json",
  "entrypoint": "api",
  "server": {
    "hostname": "127.0.0.1",
    "port": 3042
  },
  "applications": [{ "id": "api", "path": "./api" }]
}
```

After, in the root `watt.config.ts`:

```ts config
import { createWattConfig } from 'wattpm'

export default createWattConfig({
  applications: [{ id: 'api', path: './api' }]
})
```

and in `api/watt.config.ts`, the application that used to be the entrypoint:

```ts config
import { createServiceConfig } from '@platformatic/service'

export default createServiceConfig({
  server: {
    hostname: '127.0.0.1',
    port: 3042
  }
})
```

Each capability exports a factory named after it — `node`, `next`, `vite`, `astro`, `remix`, `nest`, `nitro`, `nuxt`, `reactRouter`, `tanstack`, `service`, `db`, `gateway`. The factory is a convenience, not the format: any capability can be named directly instead, and a capability that ships no factory has to be.

```ts config
export default {
  module: '@platformatic/node'
}
```

Do not put `server` in an `applications` entry. It belongs to the capability configuration. HTTPS and `portAssignment` move with it; `backlog` applies when the capability's underlying server API supports it.

If the v3 entrypoint used `server.portAssignment: "perWorkerIncrement"` to run several workers on a fixed port without `SO_REUSEPORT` — on macOS or Windows, where nothing else does — move that setting with the rest. The `workers` count stays on the runtime's `applications` entry, and worker *N* listens on `port + N` exactly as before:

```ts config
import { createServiceConfig } from '@platformatic/service'

export default createServiceConfig({
  server: {
    hostname: '127.0.0.1',
    port: 3042,
    portAssignment: 'perWorkerIncrement'
  }
})
```

A root `server` block that is discarded produces a warning rather than a silent drop: the runtime cannot move it for you, because the configuration it belongs in is a different file.

## Let applications own custom listeners

A Platformatic-managed capability starts its own server only when its capability configuration defines `server.port`. Omit `server.port` when the application should not open a managed listener, or set it to `0` for an ephemeral one.

Node.js applications without a `create()` or `build()` factory, and applications started through custom commands, call `listen()` themselves. The runtime observes the address they choose without changing it. A Node.js factory that returns a server keeps the managed lifecycle: `@platformatic/node` starts the returned server using its capability configuration.

The runtime no longer uses an application-level port environment setting and does not write `PORT`. Read the variable where you want it:

```ts config
import { createServiceConfig } from '@platformatic/service'

export default createServiceConfig({
  server: { port: Number(process.env.HTTP_PORT || 3042) }
})
```

## The `useHttp` and `websocket` application flags are gone

v3 had two application-entry flags that a listener now replaces or the mesh makes unnecessary. `migrate` drops both.

`useHttp` made an application listen on TCP even when it was not the entrypoint. v4 has no `useHttp`: a capability that declares `server.port` is always a real listener, so the port moves into the capability configuration (see [Move listener configuration to the capability](#move-listener-configuration-to-the-capability)) and the flag disappears.

`websocket` made an application bind a TCP port so the gateway could hand WebSocket upgrades off to it. v4 carries WebSocket connections over the in-memory application mesh, the same transport as mesh HTTP, so an application needs neither the flag nor a port to be reachable over WebSockets. Remove `websocket: true` from application entries; WebSocket proxying through the gateway works with no extra configuration.

## A single application needs no root

A project with one application can be configured by that application's file alone — the bare factory export is auto-wrapped as a one-application runtime:

```ts config
import { createNextConfig } from '@platformatic/next'

export default createNextConfig({
  server: { port: Number(process.env.PORT || 3042) }
})
```

Add a root only when you have something to say at the root. The singular `application` key is there for that case, so one application with runtime options never needs a one-element array:

```ts config
import { createWattConfig } from 'wattpm'
import { createNextConfig } from '@platformatic/next'

export default createWattConfig({
  logger: { level: 'info' },
  application: {
    workers: 2,
    config: createNextConfig({
      server: { port: Number(process.env.PORT || 3042) }
    })
  }
})
```

## Update programmatic startup code

`runtime.start()` and `runtime.getUrls()` return observed URLs keyed by worker ID. The key format is `applicationId:workerId`.

Before:

```js
await runtime.start()
const { url } = await runtime.getApplicationDetails('api')
```

After:

```js
const { 'api:0': url } = await runtime.start()
```

For every running worker with a listening server:

```js
const urls = runtime.getUrls()
// { 'api:0': 'http://127.0.0.1:3042', 'api:1': 'http://127.0.0.1:3042' }
```

Pass an application ID to select only its workers:

```js
const apiUrls = runtime.getUrls('api')
```

## Update custom Undici interceptors

Runtime v4 uses Undici 8 for the global dispatcher. Custom modules configured through `runtime.undici.interceptors`
must use the Undici 8 dispatcher handler lifecycle. The legacy handler callbacks are not supported:

| Undici 7 | Undici 8 |
| --- | --- |
| `onConnect` | `onRequestStart` |
| `onHeaders` | `onResponseStart` |
| `onData` | `onResponseData` |
| `onComplete` | `onResponseEnd` |
| `onError` | `onResponseError` |

For example, update a response handler from:

```js
class ResponseHandler {
  onHeaders (statusCode, headers) {
    // ...
  }
}
```

to the Undici 8 lifecycle:

```js
class ResponseHandler {
  onResponseStart (controller, statusCode, headers) {
    // ...
  }
}
```

See the [Undici Dispatcher documentation](https://undici.nodejs.org/#/docs/api/Dispatcher) for the complete handler
contract.
