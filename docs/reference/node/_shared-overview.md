import Issues from '../../getting-started/issues.md';

## API

During application execution some APIs are made available in the `globalThis.platformatic` object.

- **`globalThis.platformatic.setBasePath(path)`**: This function can be use to override the base path for the application. If not properly configure in the composer, this can make your application unaccessible.
- **`globalThis.platformatic.applicationId`**: The id of the application.
- **`globalThis.platformatic.workerId`**: The id of the application worker.
- **`globalThis.platformatic.root`**: The root directory of the application.
- **`globalThis.platformatic.basePath`**: The base path of the application in the composer.
- **`globalThis.platformatic.logLevel`**: The log level configured for the application.
- **`globalThis.platformatic.events.on('close')`**: This event is emitted when the process is being closed. A listener should be installed to perform a graceful close, which must finish in 10 seconds. If there is no listener, the process will be terminated by invoking `process.exit(0)`.
- **`globalThis.platformatic.setCustomHealthCheck(fn)`**: This function can be use to set a custom healthcheck function for the application. The function should return a boolean value, or an object with the following properties:
  - `status`: a boolean indicating if the health check is successful
  - `statusCode`: an optional HTTP status code
  - `body`: an optional body to return

The healthcheck function will ensure the readiness of the application, and the readiness check function will ensure the readiness of the application dependencies; if the healthcheck fails, the readiness check will fail, and the application will be marked as unhealthy; in this case, the liveness probe will return the readiness check response in the body.

- **`globalThis.platformatic.setCustomReadinessCheck(fn)`**: This function can be use to set a custom readiness check function for the application. The function should return a boolean value, or an object with the following properties:
  - `status`: a boolean indicating if the readiness check is successful
  - `statusCode`: an optional HTTP status code
  - `body`: an optional body to return

- **`globalThis.platformatic.sharedContext.update(contextUpdate, options)`**: This function can be use to update the shared context. Context is shared between all runtime applications.
  - `contextUpdate`: an object with the context updates
  - `options`: an optional object with the following properties:
    - `overwrite`: a boolean value indicating if the context should be overwritten or merged. Default is `false`

- **`globalThis.platformatic.sharedContext.get()`**: This function can be use to get the shared context.

### Messaging API

Services can talk to each other using a messaging API available in the `globalThis.platformatic.messaging` object.

Once an application adds an handler via `globalThis.platformatic.messaging.handle` API, then any other application can invoke the function using the `globalThis.platformatic.messaging.send` API.

Here it is an example:

```js
// web/service/index.js

globalThis.platformatic.messaging.handle({
  async time({ offset }) {
    return Date.now() + offset
  }
})
```

```js
// web/entrypoint/index.js

app.get('/time', async req => {
  const response = await globalThis.platformatic.messaging.send('application', 'time', { offset: 1000 })

  return { thread: response }
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

Here it is an example of how to register a custom metric:

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

The usage of the package is straight-forward:

```js
import { getGlobal } from '@platformatic/globals`

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

export function create() {
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

export function create() {
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
    "start": "platformatic start"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "@platformatic/node": "^2.48.0"
  }
}
```

<Issues />
