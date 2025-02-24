import Issues from '../getting-started/issues.md';

## API

During service execution some APIs are made available in the `globalThis.platformatic` object.

- **`globalThis.platformatic.setBasePath(path)`**: This function can be use to override the base path for the service. If not properly configure in the composer, this can make your application unaccessible.
- **`globalThis.platformatic.serviceId`**: The id of the service.
- **`globalThis.platformatic.workerId`**: The id of the service worker.
- **`globalThis.platformatic.root`**: The root directory of the service.
- **`globalThis.platformatic.basePath`**: The base path of the service in the composer.
- **`globalThis.platformatic.logLevel`**: The log level configured for the service.
- **`globalThis.platformatic.events.on('close')`**: This event is emitted when the process is being closed. A listener should be installed to perform a graceful close, which must finish in 10 seconds. If there is no listener, the process will be terminated by invoking `process.exit(0)`.

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

<Issues />
