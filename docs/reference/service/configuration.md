# Configuration

Platformatic Service configured with a configuration file. It supports the use
of environment variables as setting values with [configuration placeholders](#configuration-placeholders).

## Configuration file

If the Platformatic CLI finds a file in the current working directory matching
one of these filenames, it will automatically load it:

- `platformatic.service.json`
- `platformatic.service.json5`
- `platformatic.service.yml` or `platformatic.service.yaml`
- `platformatic.service.tml` or `platformatic.service.toml`

Alternatively, a [`--config` option](/reference/cli.md#service) with a configuration
filepath can be passed to most `platformatic service` CLI commands.

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

Configuration settings are organised into the following groups:

- [`server`](#server) **(required)**
- [`service`](#service)
- [`metrics`](#metrics)
- [`plugins`](#plugins)
- [`telemetry`](#telemetry)
- [`watch`](#watch)
- [`clients`](#clients)

Sensitive configuration settings, such as a database connection URL that contains
a password, should be set using [configuration placeholders](#configuration-placeholders).

### `server`

A **required** object with the following settings:

- **`hostname`** (**required**, `string`) — Hostname where Platformatic Service server will listen for connections.
- **`port`** (**required**, `number` or `string`) — Port where Platformatic Service server will listen for connections.
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

### `metrics`

Configuration for a [Prometheus](https://prometheus.io/) server that will export monitoring metrics
for the current server instance. It uses [`fastify-metrics`](https://github.com/SkeLLLa/fastify-metrics)
under the hood.

This setting can be a `boolean` or an `object`. If set to `true` the Prometheus server will listen on `http://0.0.0.0:9090`.

Supported object properties:

- **`hostname`** (`string`) — The hostname where Prometheus server will listen for connections.
- **`port`** (`number` or `string`) — The port where Prometheus server will listen for connections.
- **`auth`** (`object`) — Basic Auth configuration. **`username`** and **`password`** are required here
  (use [environment variables](#environment-variables)).

### `plugins`

An optional object that defines the plugins loaded by Platformatic Service.
- **`paths`** (**required**, `array`): an array of paths (`string`)
  or an array of objects composed as follows,
  - `path` (`string`): Relative path to plugin's entry point.
  - `options` (`object`): Optional plugin options.
  - `encapsulate` (`boolean`): if the path is a folder, it instruct Platformatic to not encapsulate those plugins.
  - `maxDepth` (`integer`): if the path is a folder, it limits the depth to load the content from.
- **`typescript`** (`boolean` or `object`): enable TypeScript compilation. A `tsconfig.json` file is required in the same folder. See [TypeScript compilation options](#typescript-compilation-options) for more details.

_Example_

```json
{
  "plugins": {
    "paths": [{
      "path": "./my-plugin.js",
      "options": {
        "foo": "bar"
      }
    }]
  }
}
```

#### `typescript` compilation options

The `typescript` can also be an object to customize the compilation. Here are the supported options:

* `enabled` (`boolean`): enables compilation
* `tsConfig` (`string`): path to the `tsconfig.json` file relative to the configuration
* `outDir` (`string`): the output directory of `tsconfig.json`, in case `tsconfig.json` is not available
and and `enabled` is set to `false` (procution build)
* `flags` (array of `string`): flags to be passed to `tsc`. Overrides `tsConfig`.


Example:

```json
{
  "plugins": {
    "paths": [{
      "path": "./my-plugin.js",
      "options": {
        "foo": "bar"
      }
    }],
    "typescript": {
      "enabled": false,
      "tsConfig": "./path/to/tsconfig.json",
      "outDir": "dist"
    }
  }
}
```

### `watch`

Disable watching for file changes if set to `false`. It can also be customized with the following options:

- **`ignore`** (`string[]`, default: `null`): List of glob patterns to ignore when watching for changes. If `null` or not specified, ignore rule is not applied. Ignore option doesn't work for typescript files.
- **`allow`** (`string[]`, default: `['*.js', '**/*.js']`): List of glob patterns to allow when watching for changes. If `null` or not specified, allow rule is not applied. Allow option doesn't work for typescript files.

  _Example_

  ```json
  {
    "watch": {
      "ignore": ["*.mjs", "**/*.mjs"],
      "allow": ["my-plugin.js", "plugins/*.js"]
    }
  }
  ```

### `service`

Configure `@platformatic/service` specific settings such as `graphql` or `openapi`:

- **`graphql`** (`boolean` or `object`, default: `false`) — Controls the GraphQL API interface, with optional GraphiQL UI.

  _Examples_

  Enables GraphQL support

  ```json
  {
    "service": {
      "graphql": true
    }
  }
  ```

  Enables GraphQL support with GraphiQL

  ```json
  {
    "service": {
      "graphql": {
        "graphiql": true
      }
    }
  }
  ```

- **`openapi`** (`boolean` or `object`, default: `false`) — Enables OpenAPI REST support.
  - If value is an object, all [OpenAPI v3](https://swagger.io/specification/) allowed properties can be passed. Also a `prefix` property can be passed to set the OpenAPI prefix.
  - Platformatic Service uses [`@fastify/swagger`](https://github.com/fastify/fastify-swagger) under the hood to manage this configuration.

  _Examples_

  Enables OpenAPI

  ```json
  {
    "service": {
      ...
      "openapi": true
    }
  }
  ```

  Enables OpenAPI with prefix

  ```json
  {
    "service": {
      "openapi": {
        "prefix": "/api"
      }
    }
  }
  ```

  Enables OpenAPI with options

  ```json
  {
    "service": {
      "openapi": {
        "info": {
          "title": "Platformatic Service",
          "description": "Exposing a SQL database as REST"
        }
      }
    }
  }
  ```
### `telemetry`
[Open Telemetry](https://opentelemetry.io/) is optionally supported with these settings:

- **`serviceName`** (**required**, `string`) — Name of the service as will be reported in open telemetry.
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


### `clients`

An array of [Platformatic Client](/reference/client/introduction.md) configurations that will be loaded by Platformatic Service.

- **`serviceId`** (`string`) - The ID of Platformatic Service inside the Platformatic Runtime. Used only in [Platformatic Runtime context](/docs/reference/runtime/introduction.md#platformatic-runtime-context).
- **`name`** (`string`) - The name of the client.
- **`type`** (`string`) - The type of the client. Supported values are `graphql` and `openapi`.
- **`schema`** (`string`) - Path to the generated client schema file.
- **`path`** (`string`) - Path to the generated client folder.
- **`url`** (`string`) - The URL of the service that the client will connect to.

## Environment variable placeholders

The value for any configuration setting can be replaced with an environment variable
by adding a placeholder in the configuration file, for example `{PLT_SERVER_LOGGER_LEVEL}`.

All placeholders in a configuration must be available as an environment variable
and must meet the [allowed placeholder name](#allowed-placeholder-names) rules.

### Example

```json title="platformatic.service.json"
{
  "server": {
    "port": "{PORT}"
  }
}
```

Platformatic will replace the placeholders in this example with the environment
variables of the same name.

### Setting environment variables

If a `.env` file exists it will automatically be loaded by Platformatic using
[`dotenv`](https://github.com/motdotla/dotenv). For example:

```plaintext title=".env"
PLT_SERVER_LOGGER_LEVEL=info
PORT=8080
```

The `.env` file must be located in the same folder as the Platformatic configuration
file or in the current working directory.

Environment variables can also be set directly on the command line, for example:

```bash
PLT_SERVER_LOGGER_LEVEL=debug npx platformatic service
```

### Allowed placeholder names

Only placeholder names prefixed with `PLT_`, or that are in this allow list, will be
dynamically replaced in the configuration file:

- `PORT`
- `DATABASE_URL`

This restriction is to avoid accidentally exposing system environment variables.
An error will be raised by Platformatic if it finds a configuration placeholder
that isn't allowed.

The default allow list can be extended by passing a `--allow-env` CLI option with a
comma separated list of strings, for example:

```bash
npx platformatic service start --allow-env=HOST,SERVER_LOGGER_LEVEL
# OR
npx platformatic start --allow-env=HOST,SERVER_LOGGER_LEVEL
```

If `--allow-env` is passed as an option to the CLI, it will be merged with the
default allow list.
