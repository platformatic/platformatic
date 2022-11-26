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
- [`metrics`](#metrics)
- [`plugin`](#plugin)

Sensitive configuration settings, such as a database connection URL that contains
a password, should be set using [configuration placeholders](#configuration-placeholders).

### `server`

A **required** object with the following settings:

- **`hostname`** (**required**, `string`) — Hostname where Platformatic DB server will listen for connections.
- **`port`** (**required**, `number`) — Port where Platformatic DB server will listen for connections.
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
  - All options will be passed to the [`@fastify/cors`](https://github.com/fastify/fastify-cors) plugin.
- **`logger`** (`object`) -- the [logger configuration](https://www.fastify.io/docs/latest/Reference/Server/#logger).
- **`pluginTimeout** (`integer`) -- the milliseconds to wait for a Fastify plugin to load, see the [fastify docs](https://www.fastify.io/docs/latest/Reference/Server/#plugintimeout) for more details.

### `metrics`

Configuration for a [Prometheus](https://prometheus.io/) server that will export monitoring metrics
for the current server instance. It uses [`fastify-metrics`](https://github.com/SkeLLLa/fastify-metrics)
under the hood.

This setting can be a `boolean` or an `object`. If set to `true` the Prometheus server will listen on `http://0.0.0.0:9090`.

Supported object properties:

- **`hostname`** (`string`) — The hostname where Prometheus server will listen for connections.
- **`port`** (`number`) — The port where Prometheus server will listen for connections.
- **`auth`** (`object`) — Basic Auth configuration. **`username`** and **`password`** are required here
  (use [environment variables](#environment-variables)).

### `plugin`

An optional object that defines a plugin loaded by Platformatic DB.
- **`path`** (**required**, `string`): Relative path to plugin's entry point.
- **`typescript`** (`object`): TypeScript configuration for the plugin.
  - **`outDir`** (`string`): Relative path to the output directory for compiled JavaScript files.
- **`hotReload`** (`boolean`, default: `true`) if `true` or not specified, the plugin is loaded using [`fastify-sandbox`](https://github.com/mcollina/fastify-sandbox), otherwise is loaded directly using `require`/`import` and the hot reload is not enabled
- **`options`** (`object`): Optional plugin options.

  _Example_

  ```json
  {
    "plugin": {
      "path": "./my-plugin.js",
      "hotReload": true,
      "options": {
        "foo": "bar"
      }
    }
  }
  ```

:::warning:::
While hot reloading is useful for development, it is not recommended to use it in production.
To switch if off, set `hotReload` to `false`.
:::

`plugin` can also be an array, like so:

  ```json
  {
    "plugin": [{
      "path": "./my-plugin.js"
    }]
  }
  ```

`plugin` can also be a string, or an array of strings.


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

Environment variables can also be set directly on the commmand line, for example:

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
npx platformatic service --allow-env=HOST,SERVER_LOGGER_LEVEL
```

If `--allow-env` is passed as an option to the CLI, it will be merged with the
default allow list.
