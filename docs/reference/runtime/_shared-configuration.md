import Issues from '../../getting-started/issues.md';

## Supported File Formats

For detailed information on supported file formats and extensions, please visit our [Supported File Formats and Extensions](../../file-formats.md#supported-file-formats) page.

## Settings

Configuration settings containing sensitive data should be set using
[environment variable placeholders](#environment-variable-placeholders).

:::info
The `autoload` and `applications` settings can be used together, but at least one
of them must be provided. When the configuration file is parsed, `autoload`
configuration is translated into `applications` configuration.
:::

### `autoload`

The `autoload` configuration is intended to be used with monorepo applications.
`autoload` is an object with the following settings:

- **`path`** (**required**, `string`) - The path to a directory containing the
  applications to load. In a traditional monorepo application, this directory is
  typically named `packages`.
- **`exclude`** (`array` of `string`s) - Child directories inside `path` that
  should not be processed.
- **`mappings`** (`object`) - Each applicaiton is given an ID and is expected
  to have a Platformatic configuration file. By default, the ID is the
  application's directory name, and the configuration file is expected to be a
  well-known Platformatic configuration file. `mappings` can be used to override
  these default values.
  Supported properties are the same of entries in `application`, except `path`, `url`, and `gitBranch`.

### `preload`

The `preload` configuration is intended to be used to register
Application Performance Monitoring (APM) agents. `preload` should contain
a path or a list of paths pointing to a CommonJS or ES module that is loaded at the start of
the app worker thread.

### `applications`

`applications` is an array of objects that defines the applications managed by the
runtime. Each application object supports the following settings:

- **`id`** (**required**, `string`) - A unique identifier for the application.
- **`path`** (**required**, `string`) - The path to the directory containing
  the application. It can be omitted if `url` is provided.
- **`url`** (**required**, `string`) - The URL of the application remote GIT repository, if it is a remote application. It can be omitted if `path` is provided. You can specify a branch using the URL fragment syntax: `https://github.com/user/repo.git#branch-name`.
- **`gitBranch`** (`string`) - The branch of the application to resolve. Takes precedence over the branch specified in the URL fragment.
- **`config`** (`string`) - The configuration file used to start
  the application.
- **`useHttp`** (`boolean`) - The application will be started on a random HTTP port
  on `127.0.0.1`, and exposed to the other applications via that port, on default it is set to `false`. Set it to `true` if you are using [@fastify/express](https://github.com/fastify/fastify-express).
- **`reuseTcpPorts`**: Enable the use of the [`reusePort`](https://nodejs.org/dist/latest/docs/api/net.html#serverlistenoptions-callback) option whenever any TCP server starts listening on a port. The default is `true`. The values specified here overrides the values specified in the runtime.
- **`workers`** - The number of workers to start for this application. If the application is the entrypoint or if the runtime is running in development mode this value is ignored and hardcoded to `1`. This can be specified as:
  - **`number`** - A fixed number of workers
  - **`object`** - Advanced worker configuration with the following properties:
    - **`static`** (`number`) - A fixed number of workers
    - **`dynamic`** (`boolean`) - Enable dynamic worker scaling. This is only meaningful when set to `false` to disable dynamic scaling for this application.
    - **`minimum`** (`number`) - Minimum number of workers when using dynamic scaling
    - **`maximum`** (`number`) - Maximum number of workers when using dynamic scaling
- **`health`** (object): Configures the health check for each worker of the application. It supports all the properties also supported in the runtime [health](#health) property. The values specified here overrides the values specified in the runtime.
- **`arguments`** (`array` of `string`s) - The arguments to pass to the application. They will be available in `process.argv`.
- **`envfile`** (`string`) - The path to an `.env` file to load for the application. By default, the `.env` file is loaded from the application directory.
- **`env`** (`object`) - An object containing environment variables to set for the application. Values set here takes precedence over values set in the `envfile`.
- **`sourceMaps`** (`boolean`) - If `true`, source maps are enabled for the application. Default: `false`.
- **`packageManager`** (`string`) - The package manager to use when using the `install-dependencies` or the `resolve` commands of `wattpm-utils`. Default is to autodetect it, unless it is specified via command line.
- **`preload`** (`string` or `array` of `string`s): A file or a list of files to load before the application code.
- **`nodeOptions`** (`string`): The `NODE_OPTIONS` to apply to the application. These options are appended to any existing option.
- **`execArgv`** (`array` of `string`s): Additional arguments to pass to application worker threads via the `execArgv` option. These arguments are passed to the Node.js executable when creating worker threads. See [Node.js Worker Threads documentation](https://nodejs.org/dist/latest/docs/api/worker_threads.html#new-workerfilename-options) for more information. Note that `execArgv` options are automatically inherited by any child worker threads created by the application.
- **`permissions`** (`object`): Configure application-level security permissions to restrict file system access. Supported properties are:
  - **`fs`**:
    - **`read`** (`array` of `string`s): Array of file system paths the application is permitted to read from. Uses the same syntax as Node.js [--allow-fs-read](https://nodejs.org/dist/latest/docs/api/cli.html#--allow-fs-read).
    - **`write`** (`array` of `string`s): Array of file system paths the application is permitted to write to. Uses the same syntax as Node.js [--allow-fs-write](https://nodejs.org/dist/latest/docs/api/cli.html#--allow-fs-write).

  When filesystem permissions are enabled, certain paths are automatically added to maintain application functionality:
  - The current Watt project's `node_modules` directory
  - The application's own `node_modules` directory
  - Any `node_modules` directories found in parent directories of the runtime path

  The security permissions are based on Node.js permission model and therefore the application will have restricted access to native modules, child processes, worker threads, the inspector protocol, and WASI.
  See the [Node.js Permission Model Constraints](https://nodejs.org/dist/latest/docs/api/permissions.html#permission-model-constraints) for complete details.

- **`dependencies`** (`array` of `string`s): A list of applications that must be started before attempting to start the current application. Note that the runtime will not perform any attempt to detect or solve dependencies cycles.
- **`telemetry`** (`object`): containing an `instrumentations` array to optionally configure additional open telemetry
  intrumentations per application, e.g.:

```json
"applications": [
    {
      "id": "api",
      "path": "./services/api",
      "telemetry": {
        "instrumentations": ["@opentelemetry/instrumentation-express"]
      }
    }
  ]
```

It's possible to specify the name of the export of the instrumentation and/or the options:

```json
"applications": [
    {
      "id": "api",
      "path": "./services/api",
      "telemetry": {
        "instrumentations": [{
          "package": "@opentelemetry/instrumentation-express",
          "exportName": "ExpressInstrumentation",
          "options": {}
        }]
      }
    }
  ]
```

An alias for `applications`. If both are present, their content will be merged.

It's also possible to disable the instrumentation by setting the `enabled` value property to `false` (env variables are also supported):

```json
"applications": [
    {
      "id": "api",
      "path": "./services/api",
      "telemetry": {
        "enabled": "false",
        "instrumentations": [{
          "package": "@opentelemetry/instrumentation-express",
        }]
      }
    }
  ]
```

### `env`

An object containing environment variables to set for all applications in the
runtime. Any environment variables set in the `env` object will be merged with
the environment variables set in the `envfile` and `env` properties of each
application, with application-level environment variables taking precedence.

### `sourceMaps`

If `true`, source maps are enabled for all applications. Default: `false`. This setting can be overridden at the application level.

### `resolvedServicesBasePath`

The base path, relative to the configuration file to store resolved applications. Each application will be saved in `{resolvedServicesBasePath}/{id}`. Default: `external`.

### `entrypoint`

The Platformatic Runtime's entrypoint is an applicaiton that is exposed
publicly. This value must be the `ID` of an application defined via the `autoload` or
`applications` configuration.

### `workers`

Configures the default number of workers to start per each application. Some values can be overridden at the application level.

This can be specified as:

- **`number`** - A fixed number of workers (minimum 1)
- **`object`** - Advanced worker configuration with the following properties:
  - **`static`** (`number`) - A fixed number of workers
  - **`dynamic`** (`boolean`) - Enable dynamic worker scaling (default: `false`). The dynamic worker scaler automatically adjusts the number of workers for each application based on Event Loop Utilization (ELU) and available system memory. It can be overridden at the application level.
  - **`minimum`** (`number`) - The minimum number of workers that can be used for each application. Default: `1`.
  - **`maximum`** (`number`) - The maximum number of workers that can be used for each application. Default: global `total` value.
  - **`total`** (`number`) - The maximum number of workers that can be used for _all_ applications. Default: `os.availableParallelism()` (typically the number of CPU cores).
  - **`maxMemory`** (`number`) - The maximum total memory in bytes that can be used by all workers. Default: 90% of the system's total memory.
  - **`cooldown`** (`number`) - The amount of milliseconds the scaling algorithm will wait after making a change before scaling up or down again. This prevents rapid oscillations. Default: `20000`.
  - **`gracePeriod`** (`number`) - The amount of milliseconds after a worker is started before the scaling algorithm will start collecting metrics for it. This allows workers to stabilize after startup. Default: `30000`.

This value is hardcoded to `1` if the runtime is running in development mode or when applying it to the entrypoint.

### `workersRestartDelay`

Configures the amount of milliseconds to wait before replacing another worker of an application during a restart.

### `gracefulShutdown`

Configures the amount of milliseconds to wait before forcefully killing an application or the runtime.

The object supports the following settings:

- **`application`** (`number`) - The graceful shutdown timeout for an application.
- **`runtime`** (`number`) - The graceful shutdown timeout for the entire runtime.

For both the settings the default is `10000` (ten seconds).

### `watch`

An optional boolean, set to default `false`, indicating if hot reloading should
be enabled for the runtime. If this value is set to `false`, it will disable
hot reloading for any applications managed by the runtime. If this value is
`true`, then hot reloading for individual applications is managed by the
configuration of that application.

Note that `watch` should be enabled for each individual application in the runtime.

:::warning
While hot reloading is useful for development, it is not recommended for use in production.
:::

### `startTimeout`

The number of milliseconds to wait before considering an application as failed to start. Default: `30000`.

### `restartOnError`

The number of milliseconds to wait before attempting to restart an application that unexpectedly exit.

If not specified or set to `true`, the default value is `5000`, set to `0` or `false` to disable.

Any value smaller than `10` will cause immediate restart of the application.

This setting is ignored in production, where applications are always restarted immediately.

### `exitOnUnhandledErrors`

When enabled (default), Platformatic automatically installs error handlers for [`uncaughtException`](https://nodejs.org/api/process.html#event-uncaughtexception) and [`unhandledRejection`](https://nodejs.org/api/process.html#event-unhandledrejection) events on each worker process. These handlers will automatically restart the affected worker when such errors occur.

Setting this to `false` disables the automatic error handling, making you responsible for implementing proper error handling in your application code.

### `health`

Configures the health check for each worker. This is enabled only if `restartOnError` is greater than zero.

The object supports the following settings:

- `enabled` (`boolean`): If to enable the health check. Default: `true`.
- `interval` (`number`): The interval between checks in milliseconds. Default: `30000`.
- `gracePeriod` (`number`): How long after the application started before starting to perform health checks. Default: `30000`.
- `maxUnhealthyChecks` (`number`): The number of consecutive failed checks before killing the worker. Default: `10`.
- `maxELU` (`number`): The maximum allowed Event Loop Utilization. The value must be a percentage between `0` and `1`. Default: `0.99`.
- `maxHeapUsed` (`number`): The maximum allowed memory utilization. The value must be a percentage between `0` and `1`. Default: `0.99`.
- `maxHeapTotal` (`number` or `string`): The maximum allowed memory allocatable by the process. The value must be an amount in bytes, in bytes or in memory units. Default: `4GB`.
- `maxYoungGeneration`(`number` or `string`): The maximum amount of memory that can be used by the young generation. The value must be an amount in bytes, in bytes or in memory units. Default: `128MB`
- `codeRangeSize` (`number` or `string`): The maximum amount of memory that can be used for code range (compiled code). The value must be an amount in bytes or in memory units. Default: `268435456` (256MB).

### `telemetry`

[Open Telemetry](https://opentelemetry.io/) is optionally supported with these settings:

- **`applicationName`** (**required**, `string`) — Name of the application as will be reported in open telemetry. In the `runtime` case, the name of the applications as reported in traces is `${applicationName}-${applicationId}`, where `applicationId` is the id of the application in the runtime.
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
    "applicationName": "test-application",
    "exporter": {
      "type": "otlp",
      "options": {
        "url": "http://localhost:4318/v1/traces"
      }
    }
  }
}
```

### `httpCache`

The `httpCache` configuration is used to enable the HTTP cache for the Platformatic Runtime.
It can be a boolean or an object with the following settings:

- **`store`** (`string`) - The store to use for the cache. Set an npm package name to use a custom store or path to a file to use a custom store from a file. By default, the `memory` store is used.
- **`methods`** (`array`) - The HTTP methods to cache. By default, GET and HEAD methods are cached.
- **`cacheTagsHeader`** (`string`) - The header to use for cache tags.
- **`maxCount`** (`integer`) - The maximum number of entries in the cache.
- **`maxSize`** (`integer`) - The maximum size of the cache in bytes.
- **`maxEntrySize`** (`integer`) - The maximum size of a single entry in the cache in bytes.
- **`origins`** (`array`) - Whitelist of origins to cache. Only requests to these origins will be cached. Supports exact string matches and regex patterns. To use a regex, wrap the pattern in forward slashes (e.g., `"/https:\\/\\/.*\\.example\\.com/"`).
- **`cacheByDefault`** (`integer`) - Default cache duration in milliseconds for responses that don't have explicit expiration headers (like `Cache-Control` or `Expires`). If not set, responses without explicit expiration will not be cached.
- **`type`** (`string`) - The type of cache. Can be `"shared"` (default) or `"private"`. A shared cache may store responses that can be shared between users, while a private cache is dedicated to a single user. Note that `s-maxage` directive only applies to shared caches, while `max-age` applies to both.

### `server`

This configures the Platformatic Runtime entrypoint `server`.

If the entrypoint has also a `server` configured, then the runtime settings override the application settings.

An object with the following settings:

- **`hostname`** — Hostname where Platformatic Service server will listen for connections.
- **`port`** — Port where Platformatic Service server will listen for connections.
- **`http2`** (`boolean`) — Enables HTTP/2 support. Default: `false`.
- **`https`** (`object`) - Configuration for HTTPS supporting the following options. Requires `https`.
  - `allowHTTP1` (`boolean`) - If `true`, the server will also accept HTTP/1.1 connections when `http2` is enabled. Default: `false`.
  - `key` (**required**, `string`, `object`, or `array`) - If `key` is a string, it specifies the private key to be used. If `key` is an object, it must have a `path` property specifying the private key file. Multiple keys are supported by passing an array of keys.
  - `cert` (**required**, `string`, `object`, or `array`) - If `cert` is a string, it specifies the certificate to be used. If `cert` is an object, it must have a `path` property specifying the certificate file. Multiple certificates are supported by passing an array of keys.

### `reuseTcpPorts`

Enable the use of the [`reusePort`](https://nodejs.org/dist/latest/docs/api/net.html#serverlistenoptions-callback) option whenever any TCP server starts listening on a port. The default is `true`. This setting can be overridden at the application level.

### `logger`

This configures the Platformatic Runtime `logger`, based on [pino](https://getpino.io).

An object with the following settings:

- **`level`** — The log level. Default: `info`. Valid values are: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`.
- **`transport`** — Configuration for logging transport, see [pino.transport](https://getpino.io/#/docs/transports) for more information. Can be configured in two ways:
  - As a single transport: An object with properties:
    - **`target`** — A string specifying the transport module.
    - **`options`** — An object containing options for the transport.
  - As multiple targets: An object with properties:
    - **`targets`** — An array of objects, each with:
      - **`target`** — A string specifying the transport module.
      - **`options`** — An object containing options for the transport.
      - **`level`** — The log level for this specific transport.
    - **`options`** — An object containing shared options for all targets.
- **`formatters`** — Configuration for logging formatters. An object with properties:
  - **`path`** (**required**) — A string specifying the path to the formatters; the file exports a function for `bindings` and `level`, see [pino.formatters](https://getpino.io/#/docs/api?id=formatters-object) for more information.
- **`timestamp`** — The timestamp format to use in logs. Valid values are: `epochTime`, `unixTime`, `nullTime`, `isoTime`, see [pino.timestamp](https://getpino.io/#/docs/api?id=pino-stdtimefunctions) for more information.
- **`redact`** — Configuration for redacting sensitive information, see [pino.redact]https://getpino.io/#/docs/redaction) for more information. An object with properties:
  - **`paths`** (**required**) — An array of strings specifying paths to redact.
  - **`censor`** — A string to replace redacted values with. Default: `[redacted]`.
- **`captureStdio`** — If `true`, the logger will capture the `stdout` and `stderr` streams of the main application. Default: `false`.
- **`base`** — The base logger configuration; setting to `null` will remove `pid` and `hostname` from the logs, otherwise it can be an object to add custom properties to the logs.
- **`messageKey`** — The key to use for the log message. Default: `msg`.
- **`customLevels`** — Configuration for custom levels, see [pino.customLevels](https://getpino.io/#/docs/api?id=customlevels-object) for more information.

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

### `applicationTimeout`

The number of milliseconds to wait when invoking another application using the its `plt.local` before considering the request timed out. Default: `300000` (5 minutes).

### `messagingTimeout`

The number of milliseconds to wait when invoking another application using the its `globalThis.platformatic.messaging.send` before considering the request timed out. Default: `300000` (5 minutes).

### `startupConcurrency`

The maximum number of concurrent operations during runtime startup, including application setup, starting/stopping workers, and health checks. This controls how many applications can be started in parallel.

Default: `os.availableParallelism() * 2` (typically twice the number of CPU cores). Minimum: `1`.

Setting a lower value can be useful when:
- Applications have heavy initialization that competes for resources
- You want more predictable startup ordering
- Memory is constrained during startup

```json title="Example configuration"
{
  "startupConcurrency": 4
}
```

### `metrics`

This configures the Platformatic Runtime Prometheus server. The Prometheus server exposes aggregated metrics from the Platformatic Runtime applications.

- **`enabled`** (`boolean` or `string`). If `true`, the Prometheus server will be started. Default: `true`.
- **`hostname`** (`string`). The hostname where the Prometheus server will be listening. Default: `0.0.0.0`.
- **`port`** (`number`). The port where the Prometheus server will be listening. Default: `9090`.
- **`endpoint`** (`string`). The endpoint where the Prometheus server will be listening. Default: `/metrics`.
- **`auth`** (`object`). Optional configuration for the Prometheus server authentication.
  - **`username`** (`string`). The username for the Prometheus server authentication.
  - **`password`** (`string`). The password for the Prometheus server authentication.
- **`readiness`** (`object` or `boolean`, default: `true`). Optional configuration for the Prometheus server readiness checks. If set to `true`, default readiness checks are enabled. If an object is provided, it can include:
  - **`endpoint`** (`string`). The endpoint for the Prometheus server readiness checks. Default: `/ready`.
  - **`success`** (`object`). The success criteria for the Prometheus server readiness checks.
    - **`statusCode`** (`number`). The HTTP status code indicating success. Default: `200`.
    - **`body`** (`string`). The response body indicating success. Default: `OK`.
  - **`fail`** (`object`). The failure criteria for the Prometheus server readiness checks.
    - **`statusCode`** (`number`). The HTTP status code indicating failure. Default: `500`.
    - **`body`** (`string`). The response body indicating failure. Default: `ERR`.
- **`liveness`** (`object` or `boolean`, default: `true`). Optional configuration for the Prometheus server liveness checks. If set to `true`, default liveness checks are enabled. If an object is provided, it can include:
  - **`endpoint`** (`string`). The endpoint for the Prometheus server liveness checks. Default: `/status`.
  - **`success`** (`object`). The success criteria for the Prometheus server liveness checks.
    - **`statusCode`** (`number`). The HTTP status code indicating success. Default: `200`.
    - **`body`** (`string`). The response body indicating success. Default: `OK`.
  - **`fail`** (`object`). The failure criteria for the Prometheus server liveness checks.
    - **`statusCode`** (`number`). The HTTP status code indicating failure. Default: `500`.
    - **`body`** (`string`). The response body indicating failure. Default: `ERR`.
- **`healthChecksTimeouts`**: The number of milliseconds to wait for Prometheus liveness or readiness checks before considering them timed out. Default: `5000` (5 seconds).
- **`plugins`** (array of `string`): A list of Fastify plugin to add to the Prometheus server.
- **`applicationLabel`** (`string`, default: `'applicationId'`): The label name to use for the application identifier in metrics (e.g., `'applicationId'`, `'serviceId'`, or any custom label name).
- **`timeout`** (`number`, default: `10000`): The timeout to wait for each worker metrics before skipping it.
- **`httpCustomLabels`** (array of `object`): Custom labels to add to HTTP metrics (`http_request_all_duration_seconds` and `http_request_all_summary_seconds`). Each label extracts its value from an HTTP request header. By default, no custom labels are added. Each object supports:
  - **`name`** (**required**, `string`): The label name to use in metrics.
  - **`header`** (**required**, `string`): The HTTP request header to extract the value from.
  - **`default`** (`string`): Default value when the header is missing. Defaults to `"unknown"`.

```json title="Example httpCustomLabels Configuration"
{
  "metrics": {
    "enabled": true,
    "httpCustomLabels": [
      { "name": "callerTelemetryId", "header": "x-plt-telemetry-id", "default": "" }
    ]
  }
}
```

- **`otlpExporter`** (`object`): Optional configuration for exporting Prometheus metrics to an OpenTelemetry Protocol (OTLP) endpoint. This enables pushing metrics to OTLP-compatible collectors like OpenTelemetry Collector, Grafana Cloud, or other observability platforms. The object supports the following settings:
  - **`enabled`** (`boolean` or `string`): Enable or disable OTLP metrics export. Default: `true` if endpoint is configured.
  - **`endpoint`** (**required**, `string`): OTLP endpoint URL for metrics (e.g., `http://localhost:4318/v1/metrics`).
  - **`interval`** (`number` or `string`): Interval in milliseconds between metric pushes. Default: `60000` (60 seconds).
  - **`headers`** (`object`): Additional HTTP headers for authentication or custom metadata. Common use cases include API keys or authentication tokens.
  - **`serviceName`** (`string`): Service name for OTLP resource attributes. Defaults to the application ID.
  - **`serviceVersion`** (`string`): Service version for OTLP resource attributes. Optional.

```json title="Example OTLP Metrics Configuration"
{
  "metrics": {
    "enabled": true,
    "port": 9090,
    "otlpExporter": {
      "endpoint": "http://otel-collector:4318/v1/metrics",
      "interval": 30000,
      "headers": {
        "x-api-key": "{OTLP_API_KEY}"
      },
      "serviceName": "my-platformatic-app",
      "serviceVersion": "1.0.0"
    }
  }
}
```

If the `metrics` object is not provided, the Prometheus server will not be started.

### `managementApi`

> **Warning:** Experimental. The feature is not subject to semantic versioning rules. Non-backward compatible changes or removal may occur in any future release. Use of the feature is not recommended in production environments.

An optional object that configures the Platformatic Management Api. If this object
is not provided, the Platformatic Management Api will be started by default. If enabled,
it will listen to UNIX Socket/Windows named pipe located at `platformatic/pids/<PID>`
inside the OS temporary folder.

- **`logs`** (`object`). Optional configuration for the runtime logs.
  - **`maxSize`** (`number`). Maximum size of the logs that will be stored in the file system in MB. Default: `200`. Minimum: `5`.
- **`socket`** (`string`). Optional custom path for the control socket. If not specified, the default platform-specific location is used (`platformatic/runtimes/<PID>/socket` on Unix, `\\.\pipe\platformatic-<PID>` on Windows).

### `scheduler`

An optional array of objects to configure HTTP call triggered by cron jobs.
_Every object_ has:

- **`enabled`** (`boolean` or `string`). Optional. If `false` the scheduler is disabled. Default: `true`.
- **`name`** (`string`): The job name
- **`cron`** (`string`): the crontab schedule expession. See https://crontab.guru/examples.html for some examples.
- **`callbackUrl`** (`string`): the HTTP URL to be called
- **`method`** (`string`): Optional, can be `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. Default: `GET`.
- **`body`** (`string` or `object`). Optional.
- **`headers`** (`object`). Optional. Headers added to the HTTP call.
- **`maxRetry`** (`number`). Number of attempts for the HTTP call. Default: 3

```json title="Example Scheduler"
{
  "scheduler": [
    {
      "name": "test",
      "callbackUrl": "http://mytarget",
      "cron": "0 * * * *",
      "mehod": "GET"
    }
  ]
}
```

### verticalScaler

:::warning
The `verticalScaler` configuration is deprecated and will be removed in a future version. These options are now mapped to the equivalent properties in the `workers` configuration. Please use the `workers` configuration instead.
:::

The `verticalScaler` configuration is used to enable the vertical scaling for the Platformatic Runtime. The vertical scaler automatically adjusts the number of workers for each application based on Event Loop Utilization (ELU) and available system memory.

The scaler operates in two modes:

- **Reactive Mode**: Triggers scaling checks immediately when any worker's ELU exceeds the `scaleUpELU` threshold
- **Periodic Mode**: Runs scaling checks at regular intervals defined by `scaleIntervalSec`

When scaling up, the algorithm ensures there is sufficient available memory to accommodate new workers based on the application's average heap usage. Available memory is calculated as `maxTotalMemory - currently used memory`, where used memory is obtained from cgroup files in containerized environments or from the operating system otherwise.

Configuration options:

- **`enabled`** (`boolean` or `string`). If `false` the vertical scaling is disabled. Default: `true`.
- **`maxTotalWorkers`** (`number`). The maximum number of workers that can be used for _all_ applications. Default: `os.availableParallelism()` (typically the number of CPU cores).
- **`maxTotalMemory`** (`number`). The maximum total memory in bytes that can be used by all workers. Default: 90% of the system's total memory.
- **`minWorkers`** (`number`). The minimum number of workers that can be used for _each_ application. It can be overridden at application level. Default: `1`.
- **`maxWorkers`** (`number`). The maximum number of workers that can be used for _each_ application. It can be overridden at application level. Default: global `maxTotalWorkers` value.
- **`cooldownSec`** (`number`). The amount of seconds the scaling algorithm will wait after making a change before scaling up or down again. This prevents rapid oscillations. Default: `60`.
- **`scaleUpELU`** (**deprecated**, `number`). **This property is deprecated and currently unused.** The ELU threshold for scaling up is hardcoded to `0.8`.
- **`scaleDownELU`** (**deprecated**, `number`). **This property is deprecated and currently unused.** The ELU threshold for scaling down is hardcoded to `0.2`.
- **`timeWindowSec`** (**deprecated**, `number`). **This property is deprecated and currently unused.** The time window for scale-up decisions is hardcoded to `10` seconds.
- **`scaleDownTimeWindowSec`** (**deprecated**, `number`). **This property is deprecated and currently unused.** The time window for scale-down decisions is hardcoded to `60` seconds.
- **`gracePeriod`** (`number`). The amount of milliseconds after a worker is started before the scaling algorithm will start collecting metrics for it. This allows workers to stabilize after startup. Default: `30000`.
- **`scaleIntervalSec`** (**deprecated**, `number`). **This property is deprecated and currently unused.** The interval for periodic scaling checks is hardcoded to `60` seconds.
- **`applications`** (`object`). An object with application-specific scaling configuration. Each key is an application ID, with an object value containing:
  - **`minWorkers`** (`number`). The minimum number of workers that can be used for this application. Default: `1`.
  - **`maxWorkers`** (`number`). The maximum number of workers that can be used for this application. Default: global `maxWorkers` value.

**Notes:**

- Applications with a fixed `workers` configuration or entrypoint applications on systems without `reusePort` support will have their min/max workers automatically set to their current value to prevent scaling.
- The scaler tracks heap memory usage and will not scale up if there is insufficient available memory, even if ELU thresholds are met.
- By default, the scaler uses 90% of total system memory as the memory limit to provide a safety buffer and prevent out-of-memory situations.

### `loadShedding`

The `loadShedding` configuration enables automatic load shedding to protect workers from being overwhelmed. When enabled, the runtime monitors each worker's Event Loop Utilization and heap memory usage, and temporarily pauses routing to workers that exceed configured thresholds. See the [Load Shedding guide](../../guides/deployment/load-shedding.md) for details on how it works.

- **`enabled`** (`boolean`). Enable load shedding. Default: `false`.
- **`maxELU`** (`number`). Maximum Event Loop Utilization (0-1) before a worker is paused. Default: `0.9`.
- **`maxHeapUsedRatio`** (`number`). Maximum heap used ratio (heapUsed/heapTotal, 0-1) before a worker is paused. Default: `0.95`.
- **`applications`** (`object`). Per-application overrides keyed by application ID. Each value is an object with optional `enabled`, `maxELU`, and `maxHeapUsedRatio` properties that override the global values.

```json title="Example configuration"
{
  "loadShedding": {
    "enabled": true,
    "maxELU": 0.9,
    "maxHeapUsedRatio": 0.95,
    "applications": {
      "api": { "maxELU": 0.85 },
      "static": { "enabled": false }
    }
  }
}
```

### policies

The `policies` configuration is used to define security policies that control communication between applications in the runtime. The security model follows an "allow by default" approach, meaning all inter-application communication is permitted unless explicitly restricted.

Configuration options:

- **`deny`** (`object`). An object that defines communication restrictions between applications. The key is the source application ID, and the value is the target application ID that should be blocked (the value can also be an array of IDs). The blocking is bidirectional. For example, denying communication from `application-1` to `application-2` will also automatically block communication from `application-2` to `application-1`.

When policies are configured, `fetch` requests or messaging API calls between blocked application will throw an exception.

### compileCache

The `compileCache` configuration enables Node.js module compile cache to improve application startup performance. When enabled, V8 compiled code is stored on disk and reused on subsequent starts, significantly reducing startup time for applications with many dependencies.

:::note
This feature requires Node.js 22.1.0 or later. On older Node.js versions, this configuration is silently ignored.
:::

The configuration can be a boolean or an object:

```json title="Simple boolean configuration"
{
  "compileCache": true
}
```

```json title="Object configuration"
{
  "compileCache": {
    "enabled": true,
    "directory": ".plt/compile-cache"
  }
}
```

Configuration options:

- **`enabled`** (`boolean`). Enable or disable the compile cache. Default: `true` when the object form is used.
- **`directory`** (`string`). The directory to store the compile cache. Default: `.plt/compile-cache` relative to the application root.

**Performance considerations:**

- **First run**: The initial startup may be slightly slower as the cache is populated.
- **Subsequent runs**: Startup time is significantly reduced as compiled code is loaded from the cache.
- **Disk space**: The cache grows with the size of your codebase and dependencies.

**Limitations:**

- **Code coverage**: V8 coverage precision may be reduced for cached functions. Disable compile cache when running coverage tests.
- **Node.js version changes**: The cache is automatically invalidated when the Node.js version changes.

This configuration can also be set at the application level to override the runtime-level setting:

```json title="Application-level override"
{
  "applications": [
    {
      "id": "my-app",
      "path": "./services/my-app",
      "compileCache": {
        "enabled": false
      }
    }
  ]
}
```

## Setting and Using ENV placeholders

The value for any configuration setting can be replaced with an environment
variable by adding a placeholder in the configuration file, for example
`{PLT_ENTRYPOINT}`.

If an `.env` file exists it will automatically be loaded by Platformatic using
[`dotenv`](https://github.com/motdotla/dotenv). For example:

```plaintext title=".env"
PLT_ENTRYPOINT=application
```

The `.env` file must be located in the same folder as the Platformatic
configuration file or in the current working directory. Each application would
also see their respective `.env` file loaded if they are located in a subdirectory.
This can be configured by the `envfile` property in the application configuration.

Environment variables can also be set directly on the command line, for example:

```bash
PLT_ENTRYPOINT=application npx wattpm start
```

:::note
Learn how to [set](../service/configuration.md#setting-environment-variables) and [use](../service/configuration.md#environment-variable-placeholders) environment variable placeholders [documentation](../service/configuration.md).
:::

### PLT_ROOT

The `{PLT_ROOT}` placeholder is automatically set to the directory containing the configuration file, so it can be used to configure relative paths. See our [documentation](../service/configuration.md#plt_root) to learn more on PLT_ROOT placeholders.

<Issues />
