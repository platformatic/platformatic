import Issues from '../getting-started/issues.md';

## Supported File Formats

For detailed information on supported file formats and extensions, please visit our [Supported File Formats and Extensions](../file-formats.md#supported-file-formats) page.

## Settings

Configuration settings containing sensitive data should be set using
[environment variable placeholders](#environment-variable-placeholders).

:::info
The `autoload` and `services` settings can be used together, but at least one
of them must be provided. When the configuration file is parsed, `autoload`
configuration is translated into `services` configuration.
:::

### `autoload`

The `autoload` configuration is intended to be used with monorepo applications.
`autoload` is an object with the following settings:

- **`path`** (**required**, `string`) - The path to a directory containing the
  microservices to load. In a traditional monorepo application, this directory is
  typically named `packages`.
- **`exclude`** (`array` of `string`s) - Child directories inside `path` that
  should not be processed.
- **`mappings`** (`object`) - Each microservice is given an ID and is expected
  to have a Platformatic configuration file. By default, the ID is the
  microservice's directory name, and the configuration file is expected to be a
  well-known Platformatic configuration file. `mappings` can be used to override
  these default values.
  - **`id`** (**required**, `string`) - The overridden ID. This becomes the new
    microservice ID.
  - \*\*`config` (`string`) - The overridden configuration file.
    name. This is the file that will be used when starting the microservice.
  - **`useHttp`** (`boolean`) - The service will be started on a random HTTP port
    on `127.0.0.1`, and exposed to the other services via that port and on default,
    it is set to `false`.
  - **`workers`** (`number`) - The number of workers to start for this service. If the service is the entrypoint or if the runtime is running in development mode this value is ignored and hardcoded to `1`.
  - **`health`** (object): Configures the health check for each worker of the service. It supports all the properties also supported in the runtime [health](#health) property. The values specified here overrides the values specified in the runtime.

### `preload`

The `preload` configuration is intended to be used to register
Application Performance Monitoring (APM) agents. `preload` should contain
a path pointing to a CommonJS or ES module that is loaded at the start of
the app worker thread.

### `services`

`services` is an array of objects that defines the microservices managed by the
runtime. Each service object supports the following settings:

- **`id`** (**required**, `string`) - A unique identifier for the microservice.
  When working with the Platformatic Composer, this value corresponds to the `id`
  property of each object in the `services` section of the config file. When
  working with client objects, this corresponds to the optional `serviceId`
  property or the `name` field in the client's `package.json` file if a
  `serviceId` is not explicitly provided.
- **`path`** (**required**, `string`) - The path to the directory containing
  the microservice. It can be omitted if `url` is provided.
- **`url`** (**required**, `string`) - The URL of the service, if it is a remote service. It can be omitted if `path` is provided.
- **`config`** (`string`) - The configuration file used to start
  the microservice.
- **`useHttp`** (`boolean`) - The service will be started on a random HTTP port
  on `127.0.0.1`, and exposed to the other services via that port, on default it is set to `false`. Set it to `true` if you are using [@fastify/express](https://github.com/fastify/fastify-express).
- **`workers`** (`number`) - The number of workers to start for this service. If the service is the entrypoint or if the runtime is running in development mode this value is ignored and hardcoded to `1`.
- **`health`** (object): Configures the health check for each worker of the service. It supports all the properties also supported in the runtime [health](#health) property. The values specified here overrides the values specified in the runtime.

If this property is present, then the services will not be reordered according to the
`getBootstrapDependencies` function and they will be started in the order they are defined in
the configuration file.

### `resolvedServicesBasePath`

The base path, relative to the configuration file to store resolved services. Each service will be saved in `{resolvedServicesBasePath}/{id}`. Default: `external`.

### `entrypoint`

The Platformatic Runtime's entrypoint is a microservice that is exposed
publicly. This value must be the `ID` of a service defined via the `autoload` or
`services` configuration.

### `workers`

The default number of workers to start per each service. It can be overriden at service level.

This value is hardcoded to `1` if the runtime is running in development mode or when applying it to the entrypoint.

### `gracefulShutdown`

Configures the amount of milliseconds to wait before forcefully killing a service or the runtime.

The object supports the following settings:

- **`service`** (`number`) - The graceful shutdown timeout for a service.
- **`runtime`** (`number`) - The graceful shutdown timeout for the entire runtime.

For both the settings the default is `10000` (ten seconds).

### `watch`

An optional boolean, set to default `false`, indicating if hot reloading should
be enabled for the runtime. If this value is set to `false`, it will disable
hot reloading for any microservices managed by the runtime. If this value is
`true`, then hot reloading for individual microservices is managed by the
configuration of that microservice.

Note that `watch` should be enabled for each individual service in the runtime.

:::warning
While hot reloading is useful for development, it is not recommended for use in production.
:::

### `startTimeout`

The number of milliseconds to wait before considering a service as failed to start. Default: `30000`.

### `restartOnError`

The number of milliseconds to wait before attempting to restart a service that unexpectedly exit.

If not specified or set to `true`, the default value is `5000`, set to `0` or `false` to disable.

### `health`

Configures the health check for each worker. This is enabled only if `restartOnError` is greater than zero.

The object supports the following settings:

- `enabled` (`boolean`): If to enable the health check. Default: `true`.
- `interval` (`number`): The interval between checks in milliseconds. Default: `30000`.
- `gracePeriod`: How long after the service started before starting to perform health checks. Default: `30000`.
- `maxUnhealthyChecks`: The number of consecutive failed checks before killing the worker. Default: `1`.
- `maxELU`: The maximum allowed Event Loop Utilization. The value must be a percentage between `0` and `1`. Default: `0.95`.
- `maxHeapUsed`: The maximum allowed memory utilization. The value must be a percentage between `0` and `1`. Default: `0.95`.
- `maxHeapTotal`: The maximum allowed memory allocatable by the process. The value must be an amount in bytes. Default: `4G`.

### `telemetry`

[Open Telemetry](https://opentelemetry.io/) is optionally supported with these settings:

- **`serviceName`** (**required**, `string`) — Name of the service as will be reported in open telemetry. In the `runtime` case, the name of the services as reported in traces is `${serviceName}-${serviceId}`, where `serviceId` is the id of the service in the runtime.
- **`version`** (`string`) — Optional version (free form)
- **`skip`** (`array`). Optional list of operations to skip when exporting telemetry defined `object` with properties:
  - `method`: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, TRACE
  - `path`. e.g.: `/documentation/json`
- **`exporter`** (`object` or `array`) — Exporter configuration. If not defined, the exporter defaults to `console`. If an array of objects is configured, every object must be a valid exporter object. The exporter object has the following properties:
  - **`type`** (`string`) — Exporter type. Supported values are `console`, `otlp`, `zipkin` and `memory` (default: `console`). `memory` is only supported for testing purposes.
  - **`options`** (`object`) — These options are supported:
    - **`url`** (`string`) — The URL to send the telemetry to. Required for `otlp` exporter. This has no effect on `console` and `memory` exporters.
    - **`headers`** (`object`) — Optional headers to send with the telemetry. This has no effect on `console` and `memory` exporters.

### `basePath`

The base path for the Platformatic Runtime. Set it when your application is deployed under a subpath, for example, `/api`.
The runtime will automatically strip the base path from the incoming requests.

:::important
OTLP traces can be consumed by different solutions, like [Jaeger](https://www.jaegertracing.io/). See the full list [here](https://opentelemetry.io/ecosystem/vendors/).
:::

```json title="Example JSON object"
{
  "telemetry": {
    "serviceName": "test-service",
    "exporter": {
      "type": "otlp",
      "options": {
        "url": "http://localhost:4318/v1/traces"
      }
    }
  }
}
```

## httpCache

The `httpCache` configuration is used to enable the HTTP cache for the Platformatic Runtime.
It can be a boolean or an object with the following settings:

- **`store`** (`string`) - The store to use for the cache. Set an npm package name to use a custom store or path to a file to use a custom store from a file. By default, the `memory` store is used.
- **`methods`** (`array`) - The HTTP methods to cache. By default, GET and HEAD methods are cached.
- **`cacheTagsHeader`** (`string`) - The header to use for cache tags.

### `server`

This configures the Platformatic Runtime entrypoint `server`.

If the entrypoint has also a `server` configured, then the runtime settings override the service settings.

An object with the following settings:

- **`hostname`** — Hostname where Platformatic Service server will listen for connections.
- **`port`** — Port where Platformatic Service server will listen for connections.
- **`http2`** (`boolean`) — Enables HTTP/2 support. Default: `false`.
- **`https`** (`object`) - Configuration for HTTPS supporting the following options. Requires `https`.
  - `allowHTTP1` (`boolean`) - If `true`, the server will also accept HTTP/1.1 connections when `http2` is enabled. Default: `false`.
  - `key` (**required**, `string`, `object`, or `array`) - If `key` is a string, it specifies the private key to be used. If `key` is an object, it must have a `path` property specifying the private key file. Multiple keys are supported by passing an array of keys.
  - `cert` (**required**, `string`, `object`, or `array`) - If `cert` is a string, it specifies the certificate to be used. If `cert` is an object, it must have a `path` property specifying the certificate file. Multiple certificates are supported by passing an array of keys.

### `logger`

This configures the Platformatic Runtime logger.

See the [logger configuration](https://www.fastify.io/docs/latest/Reference/Server/#logger) for more information.

### `undici`

This configures the [`undici`](https://undici.nodejs.org) global
[Dispatcher](https://undici.nodejs.org/#/docs/api/Dispatcher).
Allowing to configure the options in the agent as well as [interceptors](https://undici.nodejs.org/#/docs/api/Dispatcher?id=dispatchercomposeinterceptors-interceptor).

```json title="Example JSON object"
{
  "undici": {
    "keepAliveTimeout": 1000,
    "keepAliveMaxTimeout": 1000,
    "interceptors": [
      {
        "module": "undici-oidc-interceptor",
        "options": {
          "clientId": "{PLT_CLIENT_ID}",
          "clientSecret": "{PLT_CLIENT_SECRET}",
          "idpTokenUrl": "{PLT_IDP_TOKEN_URL}",
          "origins": ["{PLT_EXTERNAL_SERVICE}"]
        }
      }
    ]
  }
}
```

It's important to note that `IDP` stands for Identity Provider, and its token `url` is the URL that will be called to generate a new token.

### `serviceTimeout`

The number of milliseconds to wait when invoking another service using the its `plt.local` before considering the request timed out. Default: `300000` (5 minutes).

### `metrics`

This configures the Platformatic Runtime Prometheus server. The Prometheus server exposes aggregated metrics from the Platformatic Runtime services.

- **`hostname`** (`string`). The hostname where the Prometheus server will be listening. Default: `0.0.0.0`.
- **`port`** (`number`). The port where the Prometheus server will be listening. Default: `9090`.
- **`endpoint`** (`string`). The endpoint where the Prometheus server will be listening. Default: `/metrics`.
- **`auth`** (`object`). Optional configuration for the Prometheus server authentication.
  - **`username`** (`string`). The username for the Prometheus server authentication.
  - **`password`** (`string`). The password for the Prometheus server authentication.

### `managementApi`

> **Warning:** Experimental. The feature is not subject to semantic versioning rules. Non-backward compatible changes or removal may occur in any future release. Use of the feature is not recommended in production environments.

An optional object that configures the Platformatic Management Api. If this object
is not provided, the Platformatic Management Api will not be started. If enabled,
it will listen to UNIX Socket/Windows named pipe located at `platformatic/pids/<PID>`
inside the OS temporary folder.

- **`logs`** (`object`). Optional configuration for the runtime logs.
  - **`maxSize`** (`number`). Maximum size of the logs that will be stored in the file system in MB. Default: `200`. Minimum: `5`.

## Setting and Using ENV placeholders

The value for any configuration setting can be replaced with an environment
variable by adding a placeholder in the configuration file, for example
`{PLT_ENTRYPOINT}`.

If an `.env` file exists it will automatically be loaded by Platformatic using
[`dotenv`](https://github.com/motdotla/dotenv). For example:

```plaintext title=".env"
PLT_ENTRYPOINT=service
```

The `.env` file must be located in the same folder as the Platformatic
configuration file or in the current working directory.

Environment variables can also be set directly on the command line, for example:

```bash
PLT_ENTRYPOINT=service npx platformatic runtime
```

:::note
Learn how to [set](../service/configuration.md#setting-environment-variables) and [use](../service/configuration.md#environment-variable-placeholders) environment variable placeholders [documentation](../service/configuration.md).
:::

### PLT_ROOT

The `{PLT_ROOT}` placeholder is automatically set to the directory containing the configuration file, so it can be used to configure relative paths. See our [documentation](../service/configuration.md#plt_root) to learn more on PLT_ROOT placeholders.

<Issues />
