import Issues from '../getting-started/issues.md';

# Configuration

Platformatic Runtime is configured with a configuration file. It supports the
use of environment variables as setting values with [environment variable placeholders](#environment-variable-placeholders).

## Configuration Files

The Platformatic CLI automatically detects and loads configuration files found in the current working directory with the file names listed [here](../file-formats.md#configuration-files).

Alternatively, you can use the [`--config` option](../cli.md#db) to specify a configuration file path for most `platformatic runtime` CLI commands. The configuration examples in this reference use the JSON format.

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
- **`exclude`** (`array` of `string`s) - Child directories inside of `path` that
should not be processed.
- **`mappings`** (`object`) - Each microservice is given an ID and is expected
to have a Platformatic configuration file. By default the ID is the
microservice's directory name, and the configuration file is expected to be a
well-known Platformatic configuration file. `mappings` can be used to override
these default values.
  - **`id`** (**required**, `string`) - The overridden ID. This becomes the new
  microservice ID.
  - **`config` (`string`) - The overridden configuration file
  name. This is the file that will be used when starting the microservice.
  - **`useHttp`** (`boolean`) - The service will be started on a random HTTP port
  on `127.0.0.1`, and exposed to the other services via that port and on default, it is set to `false`. Set it to `true` if you are using [@fastify/express](https://github.com/fastify/fastify-express).

If the microservice exports a `getBootstrapDependencies` function, then it will used
to build a services dependencies graph and services will be reordered and started accordingly.

### `preload`

The `preload` configuration is intended to be used to register
Application Performance Monitoring (APM) agents. `preload` should contain
a path pointing to a CommonJS or ES module that is loaded at the start of
of the app worker thread.

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
the microservice.
- **`config`** (`string`) - The configuration file used to start
the microservice.
- **`useHttp`** (`boolean`) - The service will be started on a random HTTP port
on `127.0.0.1`, and exposed to the other services via that port, on default it is set to `false`. Set it to `true` if you are using [@fastify/express](https://github.com/fastify/fastify-express).

If this property is present, then the services will not be reordered according to the
`getBootstrapDependencies` function and they will be started in the order they are defined in
the configuration file.

### `entrypoint`

The Platformatic Runtime's entrypoint is a microservice that is exposed
publicly. This value must be the `ID` of a service defined via the `autoload` or
`services` configuration.

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

### `restartOnError`

The number of milliseconds to wait before attempting to restart a service that unexpectedly exit. 

If not specified or set to `true`, the default value is `5000`, set to `0` or `false` to disable.

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

### `server`

This configures the Platformatic Runtime entrypoint `server`. If the entrypoint has also a `server` configured, when the runtime is started, this configuration is used. 

See the Platformatic [Service server documentation](../service/configuration.md#server) for more details. 

### `undici`

This configures the [`undici`](https://undici.nodejs.org) global
[Dispatcher](https://undici.nodejs.org/#/docs/api/Dispatcher).
Allowing to configure the options in the agent as well as [interceptors](https://undici.nodejs.org/#/docs/api/Dispatcher?id=dispatchercomposeinterceptors-interceptor).


  ```json title="Example JSON object"
  {
    "undici": {
        "keepAliveTimeout": 1000,
        "keepAliveMaxTimeout": 1000,
        "interceptors": [{
            "module": "undici-oidc-interceptor",
            "options": {
                "clientId": "{PLT_CLIENT_ID}",
                "clientSecret": "{PLT_CLIENT_SECRET}",
                "idpTokenUrl": "{PLT_IDP_TOKEN_URL}",
                "origins": ["{PLT_EXTERNAL_SERVICE}"]
            }
        }]
    }
  }
  ```

It's important to note that `IDP` stands for Identity Provider, and its token `url` is the URL that will be called to generate a new token.

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