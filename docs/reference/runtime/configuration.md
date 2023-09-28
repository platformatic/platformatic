# Configuration

Platformatic Runtime is configured with a configuration file. It supports the
use of environment variables as setting values with [configuration placeholders](#configuration-placeholders).

## Configuration file

If the Platformatic CLI finds a file in the current working directory matching
one of these filenames, it will automatically load it:

- `platformatic.runtime.json`
- `platformatic.runtime.json5`
- `platformatic.runtime.yml` or `platformatic.runtime.yaml`
- `platformatic.runtime.tml` or `platformatic.runtime.toml`

Alternatively, a [`--config` option](/reference/cli.md#service) with a configuration
filepath can be passed to most `platformatic runtime` CLI commands.

The configuration examples in this reference use JSON.

### Supported formats

| Format | Extensions |
| :-- | :-- |
| JSON | `.json` |
| JSON5 | `.json5` |
| YAML | `.yml`, `.yaml` |
| TOML | `.tml` |

Comments are supported by the JSON5, YAML and TOML file formats.

## Settings

Configuration settings are organized into the following groups:

- [`autoload`](#autoload)
- [`services`](#services)
- [`entrypoint`](#entrypoint) **(required)**
- [`hotReload`](#hotReload)
- [`allowCycles`](#allowCycles)
- [`telemetry`](#telemetry)
- [`server`](#server)

Configuration settings containing sensitive data should be set using
[configuration placeholders](#configuration-placeholders).

The `autoload` and `services` settings can be used together, but at least one
of them must be provided. When the configuration file is parsed, `autoload`
configuration is translated into `services` configuration.

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
  - **`config` (**required**, `string`) - The overridden configuration file
  name. This is the file that will be used when starting the microservice.

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
- **`config`** (**required**, `string`) - The configuration file used to start
the microservice.

### `entrypoint`

The Platformatic Runtime's entrypoint is a microservice that is exposed
publicly. This value must be the ID of a service defined via the `autoload` or
`services` configuration.

### `hotReload`

An optional boolean, defaulting to `false`, indicating if hot reloading should
be enabled for the runtime. If this value is set to `false`, it will disable
hot reloading for any microservices managed by the runtime. If this value is
`true`, hot reloading for individual microservices is managed by the
configuration of that microservice.

:::warning
While hot reloading is useful for development, it is not recommended for use in
production.
:::

### `allowCycles`

An optional boolean, defaulting to `false`, indicating if dependency cycles
are allowed between microservices managed by the runtime. When the Platformatic
Runtime parses the provided configuration, it examines the clients of each
microservice, as well as the services of Platformatic Composer applications to
build a dependency graph. A topological sort is performed on this dependency
graph so that each service is started after all of its dependencies have been
started. If there are cycles, the topological sort fails and the Runtime does
not start any applications.

If `allowCycles` is `true`, the topological sort is skipped, and the
microservices are started in the order specified in the configuration file.

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
        
Note that OTLP traces can be consumed by different solutions, like [Jaeger](https://www.jaegertracing.io/). [Here](https://opentelemetry.io/ecosystem/vendors/) the full list.

  _Example_

  ```json
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

A object with the following settings:

- **`hostname`** (**required**, `string`) — Hostname where Platformatic Runtime entrypoint server will listen for connections.
- **`port`** (**required**, `number` or `string`) — Port where Platformatic Runtime etnrypoint server will listen for connections.
- **`healthCheck`** (`boolean` or `object`) — Enables the health check endpoint.
  - Powered by [`@fastify/under-pressure`](https://github.com/fastify/under-pressure).
  - The value can be an object, used to specify the interval between checks in milliseconds (default: `5000`)

  _Example_

  ```json
  {
    "server": {
      ...
      "healthCheck": {
        "interval": 2000
      }
    }
  }
  ```
- **`cors`** (`object`) — Configuration for Cross-Origin Resource Sharing (CORS) headers.
  - All options will be passed to the [`@fastify/cors`](https://github.com/fastify/fastify-cors) plugin. In order to specify a `RegExp` object, you can pass `{ regexp: 'yourregexp' }`,
    it will be automatically converted
- **`https`** (`object`) - Configuration for HTTPS supporting the following options.
  - `key` (**required**, `string`, `object`, or `array`) - If `key` is a string, it specifies the private key to be used. If `key` is an object, it must have a `path` property specifying the private key file. Multiple keys are supported by passing an array of keys.
  - `cert` (**required**, `string`, `object`, or `array`) - If `cert` is a string, it specifies the certificate to be used. If `cert` is an object, it must have a `path` property specifying the certificate file. Multiple certificates are supported by passing an array of keys.

- **`logger`** (`object`) -- the [logger configuration](https://www.fastify.io/docs/latest/Reference/Server/#logger).
- **`pluginTimeout`** (`integer`) -- the number of milliseconds to wait for a Fastify plugin to load
- **`bodyLimit`** (`integer`) -- the maximum request body size in bytes
- **`maxParamLength`** (`integer`) -- the maximum length of a request parameter
- **`caseSensitive`** (`boolean`) -- if `true`, the router will be case sensitive
- **`ignoreTrailingSlash`** (`boolean`) -- if `true`, the router will ignore the trailing slash
- **`ignoreTrailingSlash`** (`boolean`) -- if `true`, the router will ignore the trailing slash
- **`connectionTimeout`** (`integer`) -- the milliseconds to wait for a new HTTP request
- **`keepAliveTimeout`** (`integer`) -- the milliseconds to wait for a keep-alive HTTP request
- **`maxRequestsPerSocket`** (`integer`) -- the maximum number of requests per socket
- **`forceCloseConnections`** (`boolean` or `"idle"`) -- if `true`, the server will close all connections when it is closed
- **`requestTimeout`** (`integer`) -- the milliseconds to wait for a request to be completed
- **`disableRequestLogging`** (`boolean`) -- if `true`, the request logger will be disabled
- **`exposeHeadRoutes`** (`boolean`) -- if `true`, the router will expose HEAD routes
- **`serializerOpts`** (`object`) -- the [serializer options](https://www.fastify.io/docs/latest/Reference/Server/#serializeropts)
- **`requestIdHeader`** (`string` or `false`) -- the name of the header that will contain the request id
- **`requestIdLogLabel`** (`string`) -- Defines the label used for the request identifier when logging the request. default: `'reqId'`
- **`jsonShorthand`** (`boolean`) -- default: `true` -- visit [fastify docs](https://www.fastify.io/docs/latest/Reference/Server/#jsonshorthand) for more details
- **`trustProxy`** (`boolean` or `integer` or `string` or `String[]`) -- default: `false` -- visit [fastify docs](https://www.fastify.io/docs/latest/Reference/Server/#trustproxy) for more details

:::tip

See the [fastify docs](https://www.fastify.io/docs/latest/Reference/Server) for more details.

:::




## Environment variable placeholders

The value for any configuration setting can be replaced with an environment
variable by adding a placeholder in the configuration file, for example
`{PLT_ENTRYPOINT}`.

All placeholders in a configuration must be available as an environment
variable and must meet the
[allowed placeholder name](#allowed-placeholder-names) rules.

### Setting environment variables

If a `.env` file exists it will automatically be loaded by Platformatic using
[`dotenv`](https://github.com/motdotla/dotenv). For example:

```plaintext title=".env"
PLT_ENTRYPOINT=service
```

The `.env` file must be located in the same folder as the Platformatic
configuration file or in the current working directory.

Environment variables can also be set directly on the commmand line, for example:

```bash
PLT_ENTRYPOINT=service npx platformatic runtime
```

### Allowed placeholder names

Only placeholder names prefixed with `PLT_`, or that are in this allow list,
will be dynamically replaced in the configuration file:

- `PORT`
- `DATABASE_URL`

This restriction is to avoid accidentally exposing system environment variables.
An error will be raised by Platformatic if it finds a configuration placeholder
that isn't allowed.

The default allow list can be extended by passing a `--allow-env` CLI option
with a comma separated list of strings, for example:

```bash
npx platformatic runtime --allow-env=HOST,SERVER_LOGGER_LEVEL
```

If `--allow-env` is passed as an option to the CLI, it will be merged with the
default allow list.
