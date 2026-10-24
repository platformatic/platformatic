---
title: Runtime APIs
label: Runtime APIs (@platformatic/globals)
---

# Runtime APIs (`@platformatic/globals`)

`@platformatic/globals` exposes typed accessors for the runtime APIs that Watt injects into each application at execution time. Applications use these APIs to read their runtime context, use the shared logger, register metrics, exchange messages, customize health checks, and publish metadata to the runtime.

The package provides the supported interface for runtime APIs. The former `globalThis.platformatic` object is not available in v4.

## Install

Add the package to the application that needs runtime APIs:

```bash
npm install @platformatic/globals
```

## Usage

```js
import { getApplicationId, getLogger, getMessaging } from '@platformatic/globals'

const applicationId = getApplicationId()
const logger = getLogger()
const messaging = getMessaging()

logger.info({ applicationId }, 'Application started')

messaging.handle('ping', () => 'pong')
```

## Availability and error handling

Runtime APIs are available when the application runs inside Watt or Platformatic Runtime. Most getters throw when the requested API is not available:

```js
import { getBasePath } from '@platformatic/globals'

const basePath = getBasePath()
```

All field-specific getters accept an optional options object. The `throwOnMissing` option defaults to `true`. Pass `{ throwOnMissing: false }` to return `undefined` instead of throwing:

```js
import { getBasePath } from '@platformatic/globals'

const basePath = getBasePath({ throwOnMissing: false }) ?? ''
```

Setter functions, such as `setCustomHealthCheck()`, throw when the corresponding runtime API is not available.

## Helpers

| API | Description |
| --- | --- |
| `getGlobal<T>()` | Returns the complete runtime API object, optionally extended with the generic type `T`. Prefer the specific getters below. |
| `getGlobals(...names)` | Returns a new `Record<string, unknown>` containing only the requested fields. Throws `PLT_GLOBALS_MISSING_FIELD` if any name is not registered. |
| `hasField(name)` | Returns whether the runtime API identified by `name` is available. |
| `updateGlobals(updates)` | Updates the private runtime API object with the values in `updates` and returns the updated object. This helper is intended for Platformatic internals and tests. |
| `removeGlobals(fields)` | Removes fields from the private runtime API object and returns the updated object. This helper is intended for Platformatic internals and tests. |

The default export is `getGlobal`.

Use `getGlobals()` to select several fields without exposing the globals container:

```js
import { getGlobals } from '@platformatic/globals'

const { logger, applicationId } = getGlobals('logger', 'applicationId')
```

The result is shallow: object values keep their original references, but assigning or deleting properties on the result does not change which values are registered. Registered `undefined` values are included. Duplicate names appear once, and calling `getGlobals()` without names returns `{}`. This helper does not accept getter options; use individual getters for optional fields or precise field types.

## Application context getters

| Getter | Description |
| --- | --- |
| `isBuilding(options?)` | Returns a boolean indicating whether the application is currently running a build step. |
| `getExecutable(options?)` | Returns the Platformatic executable name as a string. |
| `getRuntimeId(options?)` | Returns the current runtime worker thread id as a number. |
| `getApplicationId(options?)` | Returns the application id as a string. |
| `getWorkerId(options?)` | Returns the current application worker id as a number or string. |
| `getRoot(options?)` | Returns the application root directory as a string. |
| `getHost(options?)` | Returns the application host as a string, or `true` when no hostname is configured. |
| `getPort(options?)` | Returns the application port as a number, or `true` when no numeric port is configured. |
| `getBasePath(options?)` | Returns the application base path in the gateway as a string, or `null` when no base path is configured. |
| `getRuntimeBasePath(options?)` | Returns the runtime base path as a string, or `null` when no runtime base path is configured. |
| `getWantsAbsoluteUrls(options?)` | Returns a boolean indicating whether the application expects absolute URLs. |
| `getConfig(options?)` | Returns the application configuration object. |
| `getRuntimeConfig(options?)` | Returns the runtime configuration object. |
| `getApplicationConfig(options?)` | Returns the runtime application descriptor, or `null` when unavailable. |
| `getAdditionalServerOptions(options?)` | Returns additional server options for the application as an object. |
| `getNextVersion(options?)` | Returns an object with the detected Next.js version, with `major` and optional `minor` numbers. |
| `getCapability(options?)` | Returns the current application capability instance as an object. |
| `getClosing(options?)` | Returns a boolean indicating whether the application is currently closing. |
| `getExitOnUnhandledErrors(options?)` | Returns a boolean indicating whether the runtime exits on unhandled errors. |
| `getReuseTcpPorts(options?)` | Returns a boolean indicating whether TCP port reuse is enabled. |
| `getCompileCache(options?)` | Returns the child context's compile-cache configuration: a boolean, an object with optional `enabled` and `directory` fields, or `undefined`. |
| `getResourceLimits(options?)` | Returns the child context's Node.js worker `ResourceLimits`, or `undefined`. |

## Internal mesh accessors

`getUndiciThreadInterceptor(options?)` returns the interceptor registered for the current worker. Its `createUpgradeAgent()` method returns a Node.js HTTP agent that routes local WebSocket upgrades through the mesh. Use `{ throwOnMissing: false }` when running outside a runtime worker is supported.

`setUndiciThreadInterceptor(interceptor)` registers or replaces that interceptor and returns `void`. It is intended for runtime initialization. Unlike capability callback setters such as `setBasePath()`, it writes the globals store directly and does not require a previously registered callback.

## Logging and observability

| Getter | Description |
| --- | --- |
| `getLogger(options?)` | Returns the application Pino logger instance. See the [logging guide](../../guides/logging.md). |
| `getLogLevel(options?)` | Returns the configured application log level. |
| `getInterceptLogging(options?)` | Returns a boolean indicating whether logging interception is enabled. |
| `getTracingConfig(options?)` | Returns the tracing configuration as an object. |
| `getTracingReady(options?)` | Returns the promise that resolves when tracing is ready. |
| `getTracerProvider(options?)` | Returns the OpenTelemetry tracer provider. |
| `getClientSpansAls(options?)` | Returns the async local storage instance used for client spans. |
| `getPrometheus(options?)` | Returns an object containing the Prometheus client and registry used by the runtime. |

### Custom metrics

Custom metrics can be registered and exported by accessing the same Prometheus registry that the runtime uses:

```js
import { getPrometheus } from '@platformatic/globals'

const { client, registry } = getPrometheus()

const customMetric = new client.Counter({
  name: 'custom_total',
  help: 'Custom metric description',
  registers: [registry]
})

customMetric.inc()
```

The returned `client` is `@platformatic/prom-client`, which is API-compatible with `prom-client`.

## Messaging and shared context

| Getter | Description |
| --- | --- |
| `getMessaging(options?)` | Returns the messaging API with `send`, `notify`, `handle`, `getWorkers`, `getWorkerForAffinity`, and `onWorkersChange` methods. |
| `getSharedContext(options?)` | Returns the shared context API with `get` and `update` methods. Context is shared between all runtime applications. |
| `getManagement(options?)` | Returns the management API object when management is enabled for the application. |
| `getITC(options?)` | Returns the low-level ITC API used for internal thread communication. This helper is intended for advanced integrations and Platformatic internals. |

### Messaging API

Applications can exchange messages through the API returned by `getMessaging()`:

```js
// web/service/index.js
import { getMessaging } from '@platformatic/globals'

const messaging = getMessaging()

messaging.handle('time', async ({ offset }) => {
  return Date.now() + offset
})
```

```js
// web/api/index.js
import { getMessaging } from '@platformatic/globals'

const messaging = getMessaging()

const response = await messaging.send('service', 'time', { offset: 1000 })
```

The messaging API contains the following functions:

| Function | Description |
| --- | --- |
| `handle(message, handler)` | Registers a handler for the specified message. |
| `handle(handlers)` | Registers multiple handlers from an object where each key is the message name. |
| `send(application, message, data?, options?)` | Sends a message to one worker of an application and waits for the handler response. Workers are selected using a round-robin algorithm, unless `options.affinity` is set. |
| `notify(application, message, data?, options?)` | Notifies all workers of an application and does not wait for a response. |
| `getWorkers(application?)` | Returns the started workers of an application, or an object with the workers of every application when called without arguments. |
| `getWorkerForAffinity(application, affinity)` | Returns the worker that receives the messages sent to the application with the given affinity key, or `null` if the application has no workers. |
| `onWorkersChange(listener)` | Invokes `listener` with the workers of every application each time the list of workers changes. Returns a function that removes the listener. |

`send()` uses a 30 second timeout by default. Configure the timeout with the runtime [`messagingTimeout`](./configuration.md#messagingtimeout) option.

Message data must be cloneable. Functions, symbols, and other non-cloneable values are sanitized. To transfer objects such as `ArrayBuffer`, `MessagePort`, and `FileHandle`, pass a `transferList` in the `send()` options:

```js
import { getMessaging } from '@platformatic/globals'
import { MessageChannel } from 'node:worker_threads'

const messaging = getMessaging()
const { port1 } = new MessageChannel()

await messaging.send('service', 'connect', { port: port1 }, { transferList: [port1] })
```

#### Worker affinity

By default, consecutive `send()` calls are distributed across the workers of the target application.
Set the `affinity` option to a non-empty string to always route messages with the same key to the same worker,
for instance to keep the state of an entity in a single worker:

```js
import { getMessaging } from '@platformatic/globals'

const messaging = getMessaging()

// All messages for the same cart reach the same worker of the "carts" application
await messaging.send('carts', 'addItem', { cart: 'cart-42', item: 'book' }, { affinity: 'cart-42' })
```

Workers are selected using [rendezvous hashing](https://en.wikipedia.org/wiki/Rendezvous_hashing) of the key over the
started workers of the target application. Every thread selects the same worker for the same key. When a worker
is added, removed, or restarted, only the keys of that worker move to a different worker. A restarted worker has
a new identifier, so its keys are redistributed.

Each worker receives a description with the following properties:

| Property | Description |
| --- | --- |
| `id` | Unique identifier of the worker, in the form `<application>:<index>`. |
| `application` | The application ID. |
| `worker` | The worker index, which is also the value of [`getWorkerId()`](#application-context-getters) in that worker. |
| `thread` | The worker thread ID. |

A worker can find out whether it is responsible for a key, and react when keys move, by combining
`getWorkerForAffinity()` and `onWorkersChange()`:

```js
import { getApplicationId, getMessaging, getWorkerId } from '@platformatic/globals'

const messaging = getMessaging()
const application = getApplicationId()
const workerId = getWorkerId()

function isOwner (key) {
  return messaging.getWorkerForAffinity(application, key)?.worker === workerId
}

messaging.onWorkersChange(() => {
  for (const key of localState.keys()) {
    if (!isOwner(key)) {
      // The key now belongs to another worker: release the local state
      localState.delete(key)
    }
  }
})
```

### Communicating with runtime extensions

When the runtime is configured with [`extensions`](./configuration.md#extensions), applications can invoke
the custom commands registered by the extensions in the main thread using the ITC API returned by `getITC()`:

```js
import { getITC } from '@platformatic/globals'

const itc = getITC()

// Invoke a custom command registered by an extension via itc.handle()
const response = await itc.send('acme:hello', { name: 'world' })

// Receive notifications sent by an extension via itc.notify()
itc.on('acme:ping', payload => {
  console.log('received', payload)
})
```

### Shared context API

The shared context API stores context that is shared between all runtime applications:

```js
import { getSharedContext } from '@platformatic/globals'

const sharedContext = getSharedContext()

sharedContext.update({ featureFlags: { checkout: true } })

const currentContext = sharedContext.get()
```

`sharedContext.update(contextUpdate, options?)` merges by default. Pass `{ overwrite: true }` to replace the current context.

## Health checks and lifecycle

| API | Description |
| --- | --- |
| `getEvents(options?)` | Returns the application `PlatformaticEvents` event emitter. |
| `registerCloseCallback(callback)` | Registers an asynchronous resource cleanup callback. |
| `getSendHealthSignal(options?)` | Returns the function used to send a health signal from the application to the runtime. |
| `setCustomHealthCheck(healthCheck)` | Sets a custom health check. |
| `setCustomReadinessCheck(readinessCheck)` | Sets a custom readiness check. |

`PlatformaticEvents` extends Node.js `EventEmitter` and adds `emitAndNotify(event, ...args)` to emit locally and notify the runtime. The `exit` event is emitted just before the worker exits, after its runtime communication channels have closed, for final synchronous cleanup.

```js
import { getEvents } from '@platformatic/globals'

const events = getEvents()

events.on('exit', () => {
  // Perform final synchronous cleanup.
})
```

`registerCloseCallback(callback)` registers asynchronous application cleanup. It also accepts an object implementing `Symbol.asyncDispose`, such as `registerCloseCallback(server)`, and invokes the method with that object as its receiver. Callbacks and disposable resources are awaited in reverse registration order after managed framework shutdown. Register them before callback execution begins.

```js
import { registerCloseCallback } from '@platformatic/globals'

registerCloseCallback(async () => {
  await database.close()
})
```

See [Application shutdown](./shutdown.md) for the shutdown sequence, signal listeners, custom commands, errors, and deadlines.

Custom health and readiness checks can return a boolean or an object with `status`, `statusCode`, and `body`, either directly or as a promise:

```js
import { setCustomHealthCheck, setCustomReadinessCheck } from '@platformatic/globals'

setCustomHealthCheck(async () => {
  return { status: true }
})

setCustomReadinessCheck(async () => {
  const response = await fetch('https://payment-service.example/status')

  if (!response.ok) {
    return {
      status: false,
      statusCode: 503,
      body: 'Payment service is unavailable'
    }
  }

  return true
})
```

Health signals are objects with the following properties:

| Property | Description |
| --- | --- |
| `type` | Signal type. |
| `value` | Optional signal value. |
| `description` | Optional signal description. |
| `timestamp` | Optional signal timestamp. |

## Schema and connection metadata setters

| Setter | Description |
| --- | --- |
| `setBasePath(path)` | Overrides the application base path. If the gateway is not configured consistently, this can make the application inaccessible. |
| `setOpenapiSchema(schema)` | Overrides the OpenAPI schema exposed by the application. |
| `setGraphqlSchema(schema)` | Overrides the GraphQL schema exposed by the application. |
| `setConnectionString(connection)` | Overrides the application database connection string. |
| `getNotifyConfig(options?)` | Returns the function used to notify the runtime of configuration changes. |

Example:

```js
import { setConnectionString, setOpenapiSchema } from '@platformatic/globals'

setConnectionString('postgres://dbuser:dbpass@mydbhost/apidb')
setOpenapiSchema(openapiSchema)
```

## HTTP cache and client metrics

| Getter | Description |
| --- | --- |
| `getInvalidateHttpCache(options?)` | Returns the HTTP cache invalidation function. |
| `getOnHttpCacheRequest(options?)` | Returns the HTTP cache request metric callback. |
| `getOnHttpCacheHit(options?)` | Returns the HTTP cache hit metric callback. |
| `getOnHttpCacheMiss(options?)` | Returns the HTTP cache miss metric callback. |
| `getOnHttpStatsFree(options?)` | Returns the HTTP client metrics callback for free connections. |
| `getOnHttpStatsConnected(options?)` | Returns the HTTP client metrics callback for connected connections. |
| `getOnHttpStatsPending(options?)` | Returns the HTTP client metrics callback for pending requests. |
| `getOnHttpStatsQueued(options?)` | Returns the HTTP client metrics callback for queued requests. |
| `getOnHttpStatsRunning(options?)` | Returns the HTTP client metrics callback for running requests. |
| `getOnHttpStatsSize(options?)` | Returns the HTTP client metrics callback for pool size. |
| `getOnActiveResourcesEventLoop(options?)` | Returns the active event loop resources metric callback. |

Invalidate HTTP cache entries by key or tag:

```js
import { getInvalidateHttpCache } from '@platformatic/globals'

const invalidateHttpCache = getInvalidateHttpCache()

invalidateHttpCache({ tags: ['products'] })
```

## Other advanced getters

| Getter | Description |
| --- | --- |
| `getInterceptors(options?)` | Returns the runtime worker interceptor registry as an object. Intended for Platformatic internals. |
| `getValkeyClients(options?)` | Returns the Valkey clients map. Intended for framework integrations and caching internals. |
