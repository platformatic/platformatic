---
title: Runtime APIs
label: Runtime APIs (@platformatic/globals)
---

# Runtime APIs (`@platformatic/globals`)

`@platformatic/globals` exposes typed accessors for the runtime APIs that Watt injects into each application at execution time. Applications use these APIs to read their runtime context, use the shared logger, register metrics, exchange messages, customize health checks, and publish metadata to the runtime.

The package replaces direct access to `globalThis.platformatic`. Direct access remains available for compatibility, but typed getters and setters are preferred.

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

All typed getters, except `getGlobal()`, accept an optional options object. The `throwOnMissing` option defaults to `true`. Pass `{ throwOnMissing: false }` to return `undefined` instead of throwing:

```js
import { getBasePath } from '@platformatic/globals'

const basePath = getBasePath({ throwOnMissing: false }) ?? ''
```

Setter functions, such as `setCustomHealthCheck()`, throw when the corresponding runtime API is not available.

## Helpers

| API | Description |
| --- | --- |
| `getGlobal<T>()` | Returns the complete legacy global object, optionally extended with the generic type `T`. Prefer the specific getters below. |
| `hasField(name)` | Returns whether the runtime API identified by `name` is available. |
| `updateGlobals(updates)` | Updates the legacy global object with the values in `updates` and returns the updated global object. This helper is intended for Platformatic internals and tests. |
| `removeGlobals(fields)` | Removes fields from the legacy global object and returns the updated global object. This helper is intended for Platformatic internals and tests. |

The default export is `getGlobal`.

## Application context getters

| Getter | Description |
| --- | --- |
| `isBuilding(options?)` | Returns a boolean indicating whether the application is currently running a build step. |
| `getExecutable(options?)` | Returns the Platformatic executable name as a string. |
| `getRuntimeId(options?)` | Returns the current runtime worker thread id as a number. |
| `getApplicationId(options?)` | Returns the application id as a string. |
| `getWorkerId(options?)` | Returns the current application worker id as a number or string. |
| `getRoot(options?)` | Returns the application root directory as a string. |
| `isEntrypoint(options?)` | Returns a boolean indicating whether the application is the runtime entrypoint. |
| `getHost(options?)` | Returns the application host as a string. |
| `getPort(options?)` | Returns the application port as a number. |
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

## Logging and observability

| Getter | Description |
| --- | --- |
| `getLogger(options?)` | Returns the application Pino logger instance. See the [logging guide](../../guides/logging.md). |
| `getLogLevel(options?)` | Returns the configured application log level. |
| `getInterceptLogging(options?)` | Returns a boolean indicating whether logging interception is enabled. |
| `getTelemetryConfig(options?)` | Returns the telemetry configuration as an object. |
| `getTelemetryReady(options?)` | Returns the promise that resolves when telemetry is ready. |
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
| `getMessaging(options?)` | Returns the messaging API with `send`, `notify`, and `handle` methods. |
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
// web/entrypoint/index.js
import { getMessaging } from '@platformatic/globals'

const messaging = getMessaging()

const response = await messaging.send('service', 'time', { offset: 1000 })
```

The messaging API contains the following functions:

| Function | Description |
| --- | --- |
| `handle(message, handler)` | Registers a handler for the specified message. |
| `handle(handlers)` | Registers multiple handlers from an object where each key is the message name. |
| `send(application, message, data?, options?)` | Sends a message to one worker of an application using a round-robin algorithm and waits for the handler response. |
| `notify(application, message, data?, options?)` | Notifies all workers of an application and does not wait for a response. |

`send()` uses a 30 second timeout by default. Configure the timeout with the runtime [`messagingTimeout`](./configuration.md#messagingtimeout) option.

Message data must be cloneable. Functions, symbols, and other non-cloneable values are sanitized. To transfer objects such as `ArrayBuffer`, `MessagePort`, and `FileHandle`, pass a `transferList` in the `send()` options:

```js
import { getMessaging } from '@platformatic/globals'
import { MessageChannel } from 'node:worker_threads'

const messaging = getMessaging()
const { port1 } = new MessageChannel()

await messaging.send('service', 'connect', { port: port1 }, { transferList: [port1] })
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
| `getSendHealthSignal(options?)` | Returns the function used to send a health signal from the application to the runtime. |
| `setCustomHealthCheck(healthCheck)` | Sets a custom health check. |
| `setCustomReadinessCheck(readinessCheck)` | Sets a custom readiness check. |

`PlatformaticEvents` extends Node.js `EventEmitter` and adds `emitAndNotify(event, ...args)` to emit locally and notify the runtime. The `close` event is emitted when the process is closing. A listener should finish graceful shutdown within the configured shutdown timeout.

```js
import { getEvents } from '@platformatic/globals'

const events = getEvents()

events.on('close', async () => {
  // Close application resources.
})
```

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

## Legacy `globalThis.platformatic` API

During application execution some APIs are also available on `globalThis.platformatic`. This API is deprecated. Prefer the typed getters and setters exported by `@platformatic/globals`.

| Legacy API | Preferred API |
| --- | --- |
| `globalThis.platformatic.applicationId` | `getApplicationId()` |
| `globalThis.platformatic.applicationConfig` | `getApplicationConfig()` |
| `globalThis.platformatic.runtimeConfig` | `getRuntimeConfig()` |
| `globalThis.platformatic.workerId` | `getWorkerId()` |
| `globalThis.platformatic.root` | `getRoot()` |
| `globalThis.platformatic.basePath` | `getBasePath()` |
| `globalThis.platformatic.logLevel` | `getLogLevel()` |
| `globalThis.platformatic.events` | `getEvents()` |
| `globalThis.platformatic.sharedContext` | `getSharedContext()` |
| `globalThis.platformatic.sendHealthSignal` | `getSendHealthSignal()` |
| `globalThis.platformatic.setBasePath(path)` | `setBasePath(path)` |
| `globalThis.platformatic.setCustomHealthCheck(fn)` | `setCustomHealthCheck(fn)` |
| `globalThis.platformatic.setCustomReadinessCheck(fn)` | `setCustomReadinessCheck(fn)` |
