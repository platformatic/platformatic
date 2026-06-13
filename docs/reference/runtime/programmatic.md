import Issues from '../../getting-started/issues.md';

# Programmatic API

The `@platformatic/runtime` package can be used to start, control, and inspect a Platformatic application from Node.js code, without going through the CLI. This is useful for tests, custom tooling, and embedding Platformatic in another application.

The API works with all Platformatic application types — `service`, `db`, `gateway`, `composer`, and `runtime` itself. Configurations that are not already a `runtime` configuration are automatically wrapped in one.

## Getting started

```js
import { create } from '@platformatic/runtime'

const app = await create('path/to/platformatic.runtime.json')
const entrypointUrl = await app.start()

const res = await fetch(entrypointUrl)
console.log(await res.json())

await app.close()
```

`create()` returns a `Runtime` instance. The instance exposes lifecycle, introspection, HTTP-injection, and per-application control methods documented below.

## Top-level functions

### `create(configOrRoot, sourceOrConfig?, context?)`

Builds a `Runtime` from a configuration file path or an in-memory configuration object. The returned runtime is **not** started — call `start()` (or pass `context.start = true`) to bring applications up.

When the configuration's `$schema` resolves to a non-runtime module (e.g. `@platformatic/service`, `@platformatic/db`, `@platformatic/gateway`), it is automatically wrapped in a runtime configuration so the same API works for any application type.

```js
import { create } from '@platformatic/runtime'

const app = await create({
  $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/3.54.0.json',
  entrypoint: 'main',
  applications: [{ id: 'main', path: './main' }]
})

await app.start()
```

Equivalent `$schema` values that `create()` accepts and wraps transparently:

```text
https://schemas.platformatic.dev/@platformatic/runtime/3.54.0.json
https://schemas.platformatic.dev/@platformatic/service/3.54.0.json
https://schemas.platformatic.dev/@platformatic/db/3.54.0.json
https://schemas.platformatic.dev/@platformatic/gateway/3.54.0.json
https://schemas.platformatic.dev/@platformatic/composer/3.54.0.json
```

By default `create()` installs signal handlers (`SIGTERM`/`SIGINT` via `close-with-grace`, and `SIGUSR2` to trigger `runtime.restart()`). Pass `context: { setupSignals: false }` to opt out — recommended when embedding the runtime in tests or another process that owns its own signal handling.

### `loadConfiguration(configOrRoot, sourceOrConfig?, context?)`

Reads a configuration file (or accepts an in-memory object), validates it against the runtime schema, applies the upgrade pipeline for older schemas, and resolves environment variables. The application type is auto-detected from the `$schema`; non-runtime configurations are wrapped in a runtime configuration via `wrapInRuntimeConfig()`.

```js
import { loadConfiguration } from '@platformatic/runtime'

const config = await loadConfiguration('/path/to/platformatic.config.json')
```

Use this when you need to inspect or mutate the resolved configuration before passing it to `create()`.

### `prepareApplication(runtimeConfig, application)`

Normalizes an application descriptor (resolving paths, detecting the capability type, applying defaults for `watch`, `management`, `workers`, `localUrl`, etc.) so it is ready to be passed to `runtime.addApplications()`.

You must call `prepareApplication()` before adding an application at runtime — see [Adding and removing applications at runtime](#adding-and-removing-applications-at-runtime).

### `wrapInRuntimeConfig(config, context?)`

Wraps a single-application configuration (service, db, gateway, composer) into a synthetic one-application runtime configuration. Called automatically by `create()` and `loadConfiguration()`; exported for advanced use cases.

### `loadApplicationsCommands(executableName?)`

Walks the applications declared in the nearest runtime configuration and aggregates any custom CLI commands they expose (via each capability's `createCommands` hook). Returns `{ applications, commands, help }`. Used by the CLI to surface application-specific subcommands.

## The `Runtime` instance

`create()` resolves to a `Runtime` instance. Its methods are listed below.

### Lifecycle

- **`runtime.start(silent = false): Promise<string | undefined>`** — Starts all applications. Returns the entrypoint's external URL (or `undefined` if no entrypoint binds an external port). If `init()` hasn't been called yet, `start()` calls it.
- **`runtime.stop(silent = false): Promise<void>`** — Stops all applications. If an entrypoint exists, it is stopped first so it stops accepting new requests immediately.
- **`runtime.close(silent = false): Promise<void>`** — Stops applications and tears the runtime down completely (closes the management API, broadcast channels, dispatcher, etc.). After `close()` the runtime cannot be restarted; create a new instance.
- **`runtime.restart(applications?: string[]): Promise<string | undefined>`** — Restarts every application (or only the IDs in `applications`). Returns the entrypoint URL once the restart completes.
- **`runtime.init(): Promise<void>`** — Performs one-time setup (loads capabilities, prepares workers). Usually called transitively by `start()`; call it explicitly only if you need the runtime in `init`'ed state without starting applications.

### HTTP injection

**`runtime.inject(id, injectParams): Promise<InjectResponse>`**

Dispatches an HTTP request straight into an application by its `id`, without going through the network. Behaves like Fastify's `inject` and is the recommended way to write integration tests against a runtime.

```js
import { create } from '@platformatic/runtime'

const app = await create('path/to/watt.json', { setupSignals: false })
await app.start()

const res = await app.inject('main', {
  method: 'POST',
  url: '/items',
  headers: { 'content-type': 'application/json' },
  body: { name: 'widget' }
})

console.log(res.statusCode, JSON.parse(res.body))

await app.close()
```

`injectParams` accepts a plain URL string as shorthand, or an object with `method`, `url`, `headers`, `query`, and `body`. When `content-type: application/json` is set, an object `body` is automatically `JSON.stringify`'d.

The response object exposes `statusCode`, `statusMessage`, `headers`, `body` (string), `payload` (alias of `body`), and `rawPayload` (`ArrayBuffer`).

### Testing Messaging API handlers

Use `setupLoopbackMessaging()` to test an application's [Messaging API](./globals.md#messaging-api) handlers without starting a runtime.

Application under test:

```js
import { getMessaging } from '@platformatic/globals'

export async function create () {
  const messaging = getMessaging()
  const interval = setInterval(() => {}, 1000)

  messaging.handle('ping', payload => {
    return { pong: payload }
  })

  return {
    isBackgroundApplication: true,
    close () {
      clearInterval(interval)
    }
  }
}
```

Test:

```js
import { setupLoopbackMessaging } from '@platformatic/runtime'
import { deepStrictEqual } from 'node:assert'
import { test } from 'node:test'
import { create } from './app.js'

test('handles ping messages', async t => {
  const messaging = setupLoopbackMessaging('frontend')
  const app = await create()

  t.after(() => {
    messaging.unmount()
    return app.close?.()
  })

  const response = await messaging.send('frontend', 'ping', { hello: 'world' })

  deepStrictEqual(response, { pong: { hello: 'world' } })
})
```

### Introspection

- **`runtime.getUrl(): string | undefined`** — The entrypoint's external URL once started, or `undefined` when there is no entrypoint.
- **`runtime.getRuntimeStatus(): string`** — One of `starting`, `started`, `stopping`, `stopped`, `closed`.
- **`runtime.getRuntimeMetadata(): Promise<RuntimeMetadata>`** — `pid`, `cwd`, `argv`, `uptimeSeconds`, `execPath`, `nodeVersion`, `projectDir`, `packageName`, `packageVersion`, `url`, `platformaticVersion`.
- **`runtime.getRuntimeConfig(includeMeta = false): object`** — The resolved configuration. When `includeMeta` is `true` the `[kMetadata]` symbol is preserved (needed by `prepareApplication()`).
- **`runtime.getRuntimeEnv(): Record<string, string>`** — Environment variables visible to the runtime process.
- **`runtime.getApplicationsIds(): string[]`** — IDs of all configured applications.
- **`runtime.getApplicationDetails(id, allowUnloaded = false): Promise<ApplicationDetails>`** — Per-application info: `type`, `status`, `dependencies`, `version`, `localUrl`, `entrypoint`, `workers`, `url`.

### Per-application control

- **`runtime.startApplication(id, silent = false): Promise<void>`**
- **`runtime.stopApplication(id, silent = false): Promise<void>`**
- **`runtime.restartApplication(id): Promise<void>`**

These act on a single application by `id`. If an entrypoint exists, it can be restarted but cannot be removed (see below).

## Adding and removing applications at runtime

The runtime supports adding and removing applications after `start()` has been called.

### `runtime.addApplications(applications, start = false)`

Registers new applications on a running runtime. If `start` is `true`, the new applications are started in parallel; otherwise they remain stopped until `startApplication()` is called.

Each entry in `applications` must be processed through `prepareApplication()` first — it normalizes paths, detects the capability type, and applies defaults the runtime expects.

```js
import { create, prepareApplication } from '@platformatic/runtime'

const app = await create('path/to/watt.json')
await app.start()

const newApplications = [
  await prepareApplication(app.getRuntimeConfig(true), {
    id: 'analytics-service',
    path: './analytics',
    workers: 2
  })
]

await app.addApplications(newApplications, true)
```

Pass `app.getRuntimeConfig(true)` (with `includeMeta: true`) so `prepareApplication()` can resolve relative paths against the runtime's root.

### `runtime.removeApplications(applications, silent = false)`

Stops the listed applications and removes them from the runtime. `applications` is an array of application IDs. Set `silent` to `true` to suppress logging.

```js
await app.removeApplications(['analytics-service'])
```

The entrypoint, when configured or automatically detected, cannot be removed; attempting to do so throws a `CannotRemoveEntrypointError`.

### Example: dynamic application management

```js
import { create, prepareApplication } from '@platformatic/runtime'

const app = await create('path/to/watt.json')
await app.start()

const newService = await prepareApplication(app.getRuntimeConfig(true), {
  id: 'analytics-service',
  path: './analytics',
  workers: 2
})

await app.addApplications([newService], true)

// Later, when no longer needed
await app.removeApplications(['analytics-service'])
```

## Other exports

The package also exports:

- **`Runtime`** — the class itself, for `instanceof` checks and advanced subclassing scenarios.
- **`Generator`**, **`WrappedGenerator`** — generators used by `create-platformatic` to scaffold new runtimes.
- **`schema`** — the JSON Schema for runtime configuration.
- **`transform`** — the configuration transform pipeline used internally.
- **`errors`** — a namespace of `@fastify/error` constructors (`ApplicationNotFoundError`, `MissingEntrypointError`, `CannotRemoveEntrypointError`, etc.).
- **`symbols`** — internal symbols (`kConfig`, `kId`, `kITC`, ...) used to attach metadata to configuration and worker objects.
- **`version`** — the package version string.

<Issues />
