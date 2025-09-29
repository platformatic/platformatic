import Issues from '../../getting-started/issues.md';

## API

During application execution some APIs are made available in the `globalThis.platformatic` object.

- **`globalThis.platformatic.setBasePath(path)`**: This function can be used to override the base path for the application. If not properly configured in the gateway, this can make your application inaccessible.
- **`globalThis.platformatic.applicationId`**: The id of the application.
- **`globalThis.platformatic.workerId`**: The id of the application worker.
- **`globalThis.platformatic.root`**: The root directory of the application.
- **`globalThis.platformatic.basePath`**: The base path of the application in the gateway.
- **`globalThis.platformatic.logLevel`**: The log level configured for the application.
- **`globalThis.platformatic.events.on('close')`**: This event is emitted when the process is being closed. A listener should be installed to perform a graceful close, which must finish in 10 seconds. If there is no listener, the process will be terminated by invoking `process.exit(0)`.
- **`globalThis.platformatic.setCustomHealthCheck(fn)`**: This function can be used to set a custom healthcheck function for the application. The function should return a boolean value, or an object with the following properties:
  - `status`: a boolean indicating if the health check is successful
  - `statusCode`: an optional HTTP status code
  - `body`: an optional body to return

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

Services can talk to each other using a messaging API available in the `globalThis.platformatic.messaging` object.

The messaging API contains the following functions:

- **`globalThis.platformatic.messaging.handle(message, handler)`**: Registers a message handler for the specified message.
  - `message`: a string with the name of the message
  - `handler`: a function that will be invoked when a message with the specified name is received

- **`globalThis.platformatic.messaging.send(application, message, data, options)`**: Sends a message to an application worker.
  - `application`: a string with the name of the application
  - `message`: a string with the name of the message
  - `data`: any cloneable JavaScript value. All non-cloneable values (functions, symbols, etc.) will be sanitized.
  - `options`: an optional object with the following properties:
    - `transferList`: a list of ArrayBuffer, MessagePort, and FileHandle objects. After transferring, they are not usable on the sending side of the channel anymore.

The `send` method sends a message to one receiving application worker using a round-robin algorithm.
The `send` method awaits for the response from the message handler. By default it uses a 30s timeout. To change the timeout, update the `messagingTimeout` option in the watt [configuration](../wattpm/configuration.md#messagingtimeout).

- **globalThis.platformatic.messaging.notify(application, message, data)**: Notifies all application workers with a message.
  - `application`: a string with the name of the application
  - `message`: a string with the name of the message
  - `data`: any cloneable JavaScript value. All non-cloneable values (functions, symbols, etc.) will be sanitized.

The `notify` method sends a message to all application workers. It does not wait for the response from the message handler.

Once an application adds a handler via `globalThis.platformatic.messaging.handle` API, then any other application can invoke the function using the `globalThis.platformatic.messaging.send` API.
If an application makes a `send` call, before a handler is registered, the `send` call throws an error. To make sure that an application is ready, use a runtime [dependencies API](../wattpm/configuration.md#applications).

Here is an example:

```js
// web/service/index.js

globalThis.platformatic.messaging.handle({
  async time ({ offset }) {
    return Date.now() + offset
  }
})
```

The `send` method sends a message to one receiving application worker using a round-robin algorithm.

```js
// web/entrypoint/index.js

app.get('/time', async req => {
  const response = await globalThis.platformatic.messaging.send('application', 'time', { offset: 1000 })

  return { thread: response }
})
```

The `notify` method sends a message to all application workers. Notification messages are exchanged using Node.js [`BroadcastChannel`](https://nodejs.org/dist/latest/docs/api/worker_threads.html#class-broadcastchannel-extends-eventtarget)

```js
// web/entrypoint/index.js

app.get('/time', async req => {
  globalThis.platformatic.messaging.notify('application', 'time', { offset: 1000 })

  return { thread: 'ok' }
})
```

Note that messages are exchanged using Node.js [`MessageChannel`](https://nodejs.org/dist/latest/docs/api/worker_threads.html#class-messagechannel) so you must eventually provide a `transferList` as via the `send` options:

```js
const { port1, port2 } = new MessageChannel()
const response = await globalThis.platformatic.messaging.send(
  'application',
  'connect',
  { port: port1 },
  { transferList: [port1] }
)
```

## Custom Metrics

Custom metrics can be registered and exported by accessing the same Prometheus registry that the rest of the Platformatic runtime is using via `globalThis.platformatic.prometheus.registry`.

In order to ensure the maximum compatibility the client package (`prom-client`) is available in `globalThis.platformatic.prometheus.client`.

Here is an example of how to register a custom metric:

```js
const { client, registry } = globalThis.platformatic.prometheus

// Register the metric
const customMetrics = new client.Counter({ name: 'custom', help: 'Custom Description', registers: [registry] })

// ...

// Later increase the value
customMetrics.inc(123)
```

:::note
Remember that it is a good practice to register metrics as soon as possible during the boot phase.
:::

### Typings for the API

In order to get full Typescript support for the API above, you can install the `@platformatic/globals` package and get an alternative, typed, access to the `globalThis.platformatic` object.

The usage of the package is straightforward:

```js
import { getGlobal } from '@platformatic/globals'

const pltApi = getGlobal()
```

### Custom Healthcheck

Custom health check can be defined to provide more specific and detailed information about the health of your application, in case the default healthcheck for the application itself is not enough and you need to add more checks for the application dependencies.

This can be done by using the `setCustomHealthCheck` method available on the `globalThis.platformatic` object, and run it as a Platformatic application.

The function should return a boolean value, or an object with the following properties, that will be used to set the status code and body of the response to the healthcheck endpoint:

- `status`: **required** a boolean value
- `statusCode`: **optional** an HTTP status code
- `body`: **optional** an HTTP response body

Here is an example of how to set a custom health check:

`app.js`

```js
import fastify from 'fastify'

export function create () {
  const app = fastify()

  globalThis.platformatic.setCustomHealthCheck(async () => {
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
import fastify from 'fastify'

export function create () {
  const app = fastify()

  globalThis.platformatic.setCustomHealthCheck(async () => {
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

  globalThis.platformatic.setCustomReadinessCheck(async () => {
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
    "fastify": "^5.0.0",
    "@platformatic/node": "^2.48.0"
  }
}
```

<Issues />
