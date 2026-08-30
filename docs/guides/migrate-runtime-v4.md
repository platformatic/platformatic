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
import { defineConfig } from 'wattpm'

/*
  `level` is an enum, so a fallback is not enough: `process.env.X ?? 'info'` has type `string`, and
  `string` is not one of the seven levels. This is the helper `migrate` writes into the file for
  you.
*/
function requiredEnum <const T extends readonly string[]> (name: string, allowed: T): T[number] {
  const value = process.env[name]

  if (!value || !allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(', ')}`)
  }

  return value as T[number]
}

export default defineConfig({
  logger: {
    level: requiredEnum('PLT_SERVER_LOGGER_LEVEL',
      ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  },
  applications: [{ id: 'api', path: './api' }]
})
```

A missing variable used to interpolate to the empty string. Now it is `undefined`, which is why what replaces a placeholder depends on what the position holds:

- **a string** — `process.env.PLT_BASE_PATH ?? ''`
- **a number** — `Number(process.env.PORT || 3042)`, with `||` rather than `??`, because `PORT=` in an env file supplies the empty string and the empty string is present
- **an enum** — `requiredEnum(...)` as above, because nothing narrows a `string` to the members
- **a boolean** — by hand. v3's rules contradicted each other by position, so there is no single conversion to write

`defineConfig` types the object; it does not transform it. Omitting it is legal and costs you the editor's help.

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
import { defineConfig } from 'wattpm'

export default defineConfig({
  applications: [{ id: 'api', path: './api' }]
})
```

and in `api/watt.config.ts`, the application that used to be the entrypoint:

```ts config
import { service } from '@platformatic/service'

export default service({
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
import { service } from '@platformatic/service'

export default service({
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
import { service } from '@platformatic/service'

export default service({
  server: { port: Number(process.env.HTTP_PORT || 3042) }
})
```

## A single application needs no root

A project with one application can be configured by that application's file alone — the bare factory export is auto-wrapped as a one-application runtime:

```ts config
import { next } from '@platformatic/next'

export default next({
  server: { port: Number(process.env.PORT || 3042) }
})
```

Add a root only when you have something to say at the root. The singular `application` key is there for that case, so one application with runtime options never needs a one-element array:

```ts config
import { defineConfig } from 'wattpm'
import { next } from '@platformatic/next'

export default defineConfig({
  logger: { level: 'info' },
  application: {
    workers: 2,
    config: next({
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
