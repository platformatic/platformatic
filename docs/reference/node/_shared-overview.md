import Issues from '../../getting-started/issues.md';

## API

During application execution, Platformatic exposes runtime APIs through typed getters from `@platformatic/globals`.

```js
import { getApplicationId, getLogger } from '@platformatic/globals'

const applicationId = getApplicationId()
const logger = getLogger()

logger.info({ applicationId }, 'Application started')
```

:::note
Direct access through the legacy global object is still supported for compatibility, but deprecated. Use the typed getters from `@platformatic/globals` instead.
:::

### Typed Getters

All typed getters, except `getGlobal()`, accept an optional `throwOnMissing` boolean parameter. It defaults to `true`, which throws when the requested runtime API is not available. Pass `false` to return `undefined` instead.

The related helpers are:

- **`getGlobal<T>()`**: Returns the complete legacy global object, optionally extended with the generic type `T`. Prefer the specific getters below.
- **`hasField(name)`**: Returns whether the runtime API identified by `name` is available.
- **`updateGlobals(updates)`**: Updates the legacy global object with the values in `updates` and returns the updated global object.

The available getters are:

- **`isBuilding(throwOnMissing?)`**: Returns whether the application is currently running a build step.
- **`getExecutable(throwOnMissing?)`**: Returns the Platformatic executable name.
- **`getRuntimeId(throwOnMissing?)`**: Returns the current runtime worker thread id.
- **`getNextVersion(throwOnMissing?)`**: Returns the Next.js version detected for the application.
- **`getExitOnUnhandledErrors(throwOnMissing?)`**: Returns whether the runtime exits on unhandled errors.
- **`getReuseTcpPorts(throwOnMissing?)`**: Returns whether TCP port reuse is enabled.
- **`getHost(throwOnMissing?)`**: Returns the application host.
- **`getPort(throwOnMissing?)`**: Returns the application port.
- **`getAdditionalServerOptions(throwOnMissing?)`**: Returns the additional server options for the application.
- **`getTelemetryConfig(throwOnMissing?)`**: Returns the telemetry configuration object.
- **`getConfig(throwOnMissing?)`**: Returns the application configuration object.
- **`getApplicationId(throwOnMissing?)`**: Returns the application id.
- **`getWorkerId(throwOnMissing?)`**: Returns the current application worker id.
- **`getRoot(throwOnMissing?)`**: Returns the application root directory.
- **`isEntrypoint(throwOnMissing?)`**: Returns whether the application is the runtime entrypoint.
- **`getBasePath(throwOnMissing?)`**: Returns the base path of the application in the gateway.
- **`getRuntimeBasePath(throwOnMissing?)`**: Returns the runtime base path.
- **`getWantsAbsoluteUrls(throwOnMissing?)`**: Returns whether the application expects absolute URLs.
- **`getLogger(throwOnMissing?)`**: Returns the application logger.
- **`getLogLevel(throwOnMissing?)`**: Returns the configured application log level.
- **`getInterceptLogging(throwOnMissing?)`**: Returns whether logging interception is enabled.
- **`getPrometheus(throwOnMissing?)`**: Returns the Prometheus client and registry used by the runtime.
- **`getClientSpansAls(throwOnMissing?)`**: Returns the async local storage used for client spans.
- **`getInterceptors(throwOnMissing?)`**: Returns the runtime worker interceptor registry.
- **`getValkeyClients(throwOnMissing?)`**: Returns the Valkey clients map.
- **`getOnHttpCacheRequest(throwOnMissing?)`**: Returns the HTTP cache request metric callback, called with `key`.
- **`getOnHttpCacheHit(throwOnMissing?)`**: Returns the HTTP cache hit metric callback, called with `key`.
- **`getOnHttpCacheMiss(throwOnMissing?)`**: Returns the HTTP cache miss metric callback, called with `key`.
- **`getOnHttpStatsFree(throwOnMissing?)`**: Returns the HTTP stats callback for free connections, called with `url` and `value`.
- **`getOnHttpStatsConnected(throwOnMissing?)`**: Returns the HTTP stats callback for connected connections, called with `url` and `value`.
- **`getOnHttpStatsPending(throwOnMissing?)`**: Returns the HTTP stats callback for pending requests, called with `url` and `value`.
- **`getOnHttpStatsQueued(throwOnMissing?)`**: Returns the HTTP stats callback for queued requests, called with `url` and `value`.
- **`getOnHttpStatsRunning(throwOnMissing?)`**: Returns the HTTP stats callback for running requests, called with `url` and `value`.
- **`getOnHttpStatsSize(throwOnMissing?)`**: Returns the HTTP stats callback for pool size, called with `url` and `value`.
- **`getOnActiveResourcesEventLoop(throwOnMissing?)`**: Returns the active event loop resources metric callback, called with `value`.
- **`getInvalidateHttpCache(throwOnMissing?)`**: Returns the HTTP cache invalidation function, called with an object containing optional `keys` and `tags` arrays.
- **`getEvents(throwOnMissing?)`**: Returns the application `PlatformaticEvents` event emitter. The `close` event is emitted when the process is being closed. A listener should finish graceful shutdown within 10 seconds. `PlatformaticEvents` extends Node.js `EventEmitter` and adds `emitAndNotify(event, ...args)` to emit locally and notify the runtime.
- **`getITC(throwOnMissing?)`**: Returns the low-level ITC API.
- **`getMessaging(throwOnMissing?)`**: Returns the messaging API.
- **`getCapability(throwOnMissing?)`**: Returns the current application capability instance.
- **`getClosing(throwOnMissing?)`**: Returns whether the application is currently closing.
- **`getSharedContext(throwOnMissing?)`**: Returns the shared context API. Context is shared between all runtime applications.
- **`getManagement(throwOnMissing?)`**: Returns the management API when management is enabled for the application.
- **`getSendHealthSignal(throwOnMissing?)`**: Returns the function used to send a health signal from the application to the runtime.
- **`getTelemetryReady(throwOnMissing?)`**: Returns the promise that resolves when telemetry is ready.
- **`getTracerProvider(throwOnMissing?)`**: Returns the OpenTelemetry tracer provider.
- **`getNotifyConfig(throwOnMissing?)`**: Returns the function used to notify the runtime of configuration changes.

The available setters are:

- **`setBasePath(path)`**: Overrides the application base path. If not properly configured in the gateway, this can make your application inaccessible.
- **`setOpenapiSchema(schema)`**: Overrides the OpenAPI schema exposed by the application.
- **`setGraphqlSchema(schema)`**: Overrides the GraphQL schema exposed by the application.
- **`setConnectionString(connection)`**: Overrides the application database connection string.
- **`setCustomHealthCheck(healthCheck)`**: Sets a custom health check. The function can return a boolean or an object with `status`, `statusCode`, and `body`, either directly or as a promise.
- **`setCustomReadinessCheck(readinessCheck)`**: Sets a custom readiness check. The function can return a boolean or an object with `status`, `statusCode`, and `body`, either directly or as a promise.

If the object returned by the `create` or `build` factory has a `Symbol.asyncDispose` method, it will be automatically called during shutdown.

### Legacy `globalThis.platformatic` API

During application execution some APIs are made available in the `globalThis.platformatic` object.

- **`globalThis.platformatic.setBasePath(path)`**: This function can be used to override the base path for the application. If not properly configured in the gateway, this can make your application inaccessible.
- **`globalThis.platformatic.applicationId`**: The id of the application.
- **`globalThis.platformatic.workerId`**: The id of the application worker.
- **`globalThis.platformatic.root`**: The root directory of the application.
- **`globalThis.platformatic.basePath`**: The base path of the application in the gateway.
- **`globalThis.platformatic.logLevel`**: The log level configured for the application.
- **`globalThis.platformatic.events.on('close')`**: This event is emitted when the process is being closed. A listener should be installed to perform a graceful close, which must finish in 10 seconds. If there is no listener, the process will be terminated by invoking `process.exit(0)`.
- **`Symbol.asyncDispose`**: If the object returned by the `create` or `build` factory has a `Symbol.asyncDispose` method, it will be automatically called during shutdown.
- **`globalThis.platformatic.setCustomHealthCheck(fn)`**: This function can be used to set a custom healthcheck function for the application. The function should return a boolean value, or an object with the following properties:
  - `status`: a boolean indicating if the health check is successful
  - `statusCode`: an optional HTTP status code
  - `body`: an optional body to return
- **`globalThis.platformatic.sendHealthSignal(signal)`**: This function can be used to send a health signal from the application to the runtime.
  - `signal`: an object with the following properties:
    - `type`: a string with the type of the signal
    - `value`: an optional value to send with the signal.
    - `description`: an optional description of the signal.

The healthcheck function will ensure the readiness of the application, and the readiness check function will ensure the readiness of the application dependencies; if the healthcheck fails, the readiness check will fail, and the application will be marked as unhealthy; in this case, the liveness probe will return the readiness check response in the body.

- **`globalThis.platformatic.setCustomReadinessCheck(fn)`**: This function can be used to set a custom readiness check function for the application. The function should return a boolean value, or an object with the following properties:
  - `status`: a boolean indicating if the readiness check is successful
  - `statusCode`: an optional HTTP status code
  - `body`: an optional body to return

- **`globalThis.platformatic.sharedContext.update(contextUpdate, options)`**: This function can be used to update the shared context. Context is shared between all runtime applications.
  - `contextUpdate`: an object with the context updates
  - `options`: an optional object with the following properties:
    - `overwrite`: a boolean value indicating if the context should be overwritten or merged. Default is `false`

- **`globalThis.platformatic.sharedContext.get()`**: This function can be used to get the shared context.

### Messaging API

Services can talk to each other using the messaging API returned by `getMessaging()` from `@platformatic/globals`.

The messaging API contains the following functions:

- **`handle(message, handler)`**: Registers a message handler for the specified message.
  - `message`: a string with the name of the message
  - `handler`: a function that will be invoked when a message with the specified name is received

- **`send(application, message, data, options)`**: Sends a message to an application worker.
  - `application`: a string with the name of the application
  - `message`: a string with the name of the message
  - `data`: any cloneable JavaScript value. All non-cloneable values (functions, symbols, etc.) will be sanitized.
  - `options`: an optional object with the following properties:
    - `transferList`: a list of ArrayBuffer, MessagePort, and FileHandle objects. After transferring, they are not usable on the sending side of the channel anymore.

The `send` method sends a message to one receiving application worker using a round-robin algorithm.
The `send` method awaits for the response from the message handler. By default it uses a 30s timeout. To change the timeout, update the `messagingTimeout` option in the watt [configuration](../wattpm/configuration.md#messagingtimeout).

- **`notify(application, message, data)`**: Notifies all application workers with a message.
  - `application`: a string with the name of the application
  - `message`: a string with the name of the message
  - `data`: any cloneable JavaScript value. All non-cloneable values (functions, symbols, etc.) will be sanitized.

The `notify` method sends a message to all application workers. It does not wait for the response from the message handler.
Notification messages are exchanged using Node.js [`BroadcastChannel`](https://nodejs.org/dist/latest/docs/api/worker_threads.html#class-broadcastchannel-extends-eventtarget). The data must be cloneable value. All non-cloneable values (functions, symbols, etc.) will be sanitized.

Once an application adds a handler via `handle`, then any other application can invoke the function using `send`.
If an application makes a `send` call, before a handler is registered, the `send` call throws an error. To make sure that an application is ready, use a runtime [dependencies API](../wattpm/configuration.md#applications).

Here is an example:

```js
// web/service/index.js
import { getMessaging } from '@platformatic/globals'

const messaging = getMessaging()
messaging.handle({
  async time ({ offset }) {
    return Date.now() + offset
  }
})
```

The `send` method sends a message to one receiving application worker using a round-robin algorithm.

```js
// web/entrypoint/index.js
import { getMessaging } from '@platformatic/globals'

const messaging = getMessaging()
app.get('/time', async req => {
  const response = await messaging.send('application', 'time', { offset: 1000 })

  return { thread: response }
})
```

The `notify` method sends a message to all application workers. Notification messages are exchanged using Node.js [`BroadcastChannel`](https://nodejs.org/dist/latest/docs/api/worker_threads.html#class-broadcastchannel-extends-eventtarget)

```js
// web/entrypoint/index.js
import { getMessaging } from '@platformatic/globals'

const messaging = getMessaging()
app.get('/time', async req => {
  messaging.notify('application', 'time', { offset: 1000 })

  return { thread: 'ok' }
})
```

Note that messages are exchanged using Node.js [`MessageChannel`](https://nodejs.org/dist/latest/docs/api/worker_threads.html#class-messagechannel) so you must eventually provide a `transferList` as via the `send` options:

```js
import { getMessaging } from '@platformatic/globals'
import { MessageChannel } from 'node:worker_threads'

const messaging = getMessaging()
const { port1, port2 } = new MessageChannel()
const response = await messaging.send(
  'application',
  'connect',
  { port: port1 },
  { transferList: [port1] }
)
```

## Custom Metrics

Custom metrics can be registered and exported by accessing the same Prometheus registry that the rest of the Platformatic runtime is using via `getPrometheus()`.

In order to ensure the maximum compatibility the client package (`@platformatic/prom-client`) is available in the object returned by `getPrometheus()`. This package is API compatible with the standard `prom-client` package but significantly faster.

Here is an example of how to register a custom metric:

```js
import { getPrometheus } from '@platformatic/globals'

const { client, registry } = getPrometheus()

// Register the metric
const customMetrics = new client.Counter({ name: 'custom', help: 'Custom Description', registers: [registry] })

// ...

// Later increase the value
customMetrics.inc(123)
```

:::note
Remember that it is a good practice to register metrics as soon as possible during the boot phase.
:::

### Custom Healthcheck

Custom health check can be defined to provide more specific and detailed information about the health of your application, in case the default healthcheck for the application itself is not enough and you need to add more checks for the application dependencies.

This can be done by using `setCustomHealthCheck()`, and run it as a Platformatic application.

The function should return a boolean value, or an object with the following properties, that will be used to set the status code and body of the response to the healthcheck endpoint:

- `status`: **required** a boolean value
- `statusCode`: **optional** an HTTP status code
- `body`: **optional** an HTTP response body

Here is an example of how to set a custom health check:

`app.js`

```js
import { setCustomHealthCheck } from '@platformatic/globals'
import fastify from 'fastify'

export function create () {
  const app = fastify()
  setCustomHealthCheck(async () => {
    return Promise.all([
      // Check if the database is reachable
      app.db.query('SELECT 1'),
      // Check if the external application is reachable
      fetch('https://payment-application.com/status')
    ])
  })

  app.get('/', (req, res) => {
    res.send('Hello')
  })

  return app
}
```

Setting custom response for the healthcheck endpoint:

```js
import { setCustomHealthCheck, setCustomReadinessCheck } from '@platformatic/globals'
import fastify from 'fastify'

export function create () {
  const app = fastify()
  setCustomHealthCheck(async () => {
    // Check if the database is reachable
    if (!app.db.query('SELECT 1')) {
      return {
        status: false,
        statusCode: 500,
        body: 'Database is unreachable'
      }
    }
    // Check if the external service is reachable
    const payment = await fetch('https://payment-service.com/status')
    if (!payment.ok) {
      return {
        status: false,
        statusCode: 500,
        body: 'Payment service is unreachable'
      }
    }
  })

  setCustomReadinessCheck(async () => {
    return Promise.all([
      // Check if the database is reachable
      app.db.query('SELECT 1'),
      // Check if the external service is reachable
      fetch('https://payment-service.com/status')
    ])
  })

  app.get('/', (req, res) => {
    res.send('Hello')
  })

  return app
}
```

`platformatic.json`

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/2.51.0.json"
}
```

`package.json`

```json
{
  "type": "module",
  "name": "application-node",
  "version": "1.0.0",
  "main": "app.js",
  "scripts": {
    "start": "wattpm start"
  },
  "dependencies": {
    "@platformatic/globals": ">=3.0.0",
    "fastify": "^5.0.0",
    "@platformatic/node": ">=3.0.0"
  }
}
```

<Issues />
