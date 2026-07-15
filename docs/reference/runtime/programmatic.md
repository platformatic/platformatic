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

### Profiling

These methods require [`@platformatic/wattpm-pprof-capture`](../../guides/profiling-with-watt.md) to be installed. The `id` can be an application ID (a worker is chosen in round-robin) or `application:worker-index` for a specific worker.

- **`runtime.startApplicationProfiling(id, options?): Promise<void>`** — Starts profiling a worker. `options.type` is `cpu` (default) or `heap`. Passing `options.durationMillis` enables continuous profiling: the profile window is rotated at that interval and each completed window emits the [`application:worker:profile:captured`](#applicationworkerprofilecaptured) event. Passing `options.eluThreshold` gates the profiler on event loop utilization: the runtime measures each worker's ELU from the main thread as part of its health metrics cycle and resumes or pauses the in-worker profiler with hysteresis. Continuous profiling is also paused while the worker ELU is above the worker's `health.maxELU`, so that profiling does not add overhead to an already overloaded worker: the in-progress window completes its full `durationMillis`, is captured and announced like any other rotation, and then profiling pauses until the worker recovers (if the ELU drops back before the window ends, the pending pause is simply cancelled). The final profile does not expire while paused, so it can be retrieved at any point during the overload. Pass `options.maxELU` to override this cutoff, or set it to `false` to disable it.
- **`runtime.stopApplicationProfiling(id, options?): Promise<Buffer>`** — Stops profiling and returns the last captured profile in pprof format.
- **`runtime.getApplicationLastProfile(id, options?): Promise<{ profile, timestamp, preserved }>`** — Returns the last profile window captured by the continuous profiler without stopping it, along with the timestamp of when the window was captured (paired atomically, so the timestamp always matches the returned profile). The pull is bounded by `options.timeout` (10s by default). When the worker cannot currently provide a profile — its event loop is blocked, it crashed, profiling was not (re)started after a replacement, no window has completed yet, or the profiler is paused below the ELU threshold — the method falls back to the most recent overload profile preserved in the main thread, if one exists: the result then has `preserved: true`, and the `timestamp` tells how old the evidence is. Preserved profiles are dropped as soon as the worker completes a newer window, and survive the worker itself only for a grace period of twice the `gracefulShutdown.runtime` timeout (20s by default), giving alert-driven collectors time to fetch the evidence of a replaced worker without stale profiles being served indefinitely.

### Events

The `Runtime` instance is an `EventEmitter`. Programmatic users and [extensions](./configuration.md#extensions) can subscribe to the following events with `runtime.on(event, listener)`.

#### Runtime status events

Emitted when the runtime changes status, with no payload: `init`, `starting`, `started`, `stopping`, `stopped`, `closing`, `closed`, `errored` (receives the error), `restarting`, `restarted`.

#### Application lifecycle events

All these events receive the application ID as payload: `application:init`, `application:starting`, `application:started`, `application:stopping`, `application:stopped`, `application:restarting`, `application:restarted`, `application:building`, `application:built`. `application:added` and `application:removed` receive the application details object instead.

#### Worker lifecycle events

All these events receive a `{ application, worker, workersCount }` payload, where `worker` is the zero-based worker index: `application:worker:init`, `application:worker:starting`, `application:worker:started`, `application:worker:stopping`, `application:worker:stopped`, `application:worker:changed`, `application:worker:reloaded`, `application:worker:exited`, `application:worker:unvailable`. Failure variants carry additional context: `application:worker:error` (adds `code`), `application:worker:start:error`, `application:worker:start:failed`, `application:worker:stop:error`, `application:worker:startTimeout` and `application:worker:exit:timeout`.

#### `application:worker:health:metrics`

Emitted every second for each running worker while health metrics collection is active. Collection is active when at least one of the following is true: a worker has health checks enabled (with `restartOnError` greater than `0`), the dynamic workers scaler is enabled, or an extension subscribed to this event during its setup.

The payload is an object with the following properties:

- **`id`** (`string`) - The full worker ID (`application:index`).
- **`application`** (`string`) - The application ID.
- **`worker`** (`number`) - The zero-based worker index.
- **`currentHealth`** (`object` or `null`) - `null` when the health collection failed. Otherwise:
  - **`elu`** (`number`) - The worker event loop utilization since the previous collection, between `0` and `1`.
  - **`heapUsed`** (`number`) - The worker used heap size, in bytes.
  - **`heapTotal`** (`number`) - The worker total heap size, in bytes. Heap statistics are refreshed once per minute.
- **`healthSignals`** (`array`) - The custom health signals sent by the worker via `sendHealthSignals` since the last collection, if any.

A related event, `application:worker:unhealthy` (with a `{ application, worker }` payload), is emitted when a worker with health checks enabled exceeds the configured thresholds and is about to be restarted.

#### `application:worker:profile:captured`

Emitted when the continuous profiler completes a profile window in a worker, that is when profiling was started with the `durationMillis` option and a rotation happened. The payload is an object with the following properties:

- **`id`** (`string`) - The full worker ID (`application:index`).
- **`application`** (`string`) - The application ID.
- **`worker`** (`number`) - The zero-based worker index.
- **`type`** (`string`) - The profile type, either `cpu` or `heap`.
- **`timestamp`** (`number`) - When the profile window was completed, in milliseconds since the epoch.

The event purposely does not carry the profile, since it can be big and there might be no consumer. Retrieve it on demand with `runtime.getApplicationLastProfile(id, { type })`, before the next window completes.

#### Custom worker events

Events emitted by application workers via the events API returned by `getEvents()` (using `emitAndNotify(name, ...args)`) are re-emitted by the runtime as `application:worker:event:<name>`, receiving the event arguments followed by the worker ID, the application ID and the worker index.

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
