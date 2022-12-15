# Configuration

Platformatic DB is configured with a configuration file. It supports the use
of environment variables as setting values with [configuration placeholders](#configuration-placeholders).

## Configuration file

If the Platformatic CLI finds a file in the current working directory matching
one of these filenames, it will automatically load it:

- `platformatic.db.json`
- `platformatic.db.json5`
- `platformatic.db.yml` or `platformatic.db.yaml`
- `platformatic.db.tml` or `platformatic.db.toml`

Alternatively, a [`--config` option](/reference/cli.md#db) with a configuration
filepath can be passed to most `platformatic db` CLI commands.

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

- [`core`](#core) **(required)**
- [`dashboard`](#dashboard)
- [`metrics`](#metrics)
- [`migrations`](#migrations)
- [`plugin`](#plugin)
- [`server`](#server) **(required)**
- [`authorization`](#authorization)

Sensitive configuration settings, such as a database connection URL that contains
a password, should be set using [configuration placeholders](#configuration-placeholders).

### `core`

A **required** object with the following settings:

- **`connectionString`** (**required**, `string`) — Database connection URL.
  - Example: `postgres://user:password@my-database:5432/db-name`

- ** `schema`** (array of `string`) - Currently supported only for postgres, schemas used tolook for entities. If not provided, the default `public` schema is used.

 _Examples_

```json
  "core": {
    "connectionString": "(...)",
    "schema": [
      "schema1", "schema2"
    ],
    ...

  },

```

  - Platformatic DB supports MySQL, MariaDB, PostgreSQL and SQLite.
- **`graphql`** (`boolean` or `object`, default: `true`) — Controls the GraphQL API interface, with optional GraphiQL UI.

  _Examples_

  Enables GraphQL support

  ```json
  {
    "core": {
      ...
      "graphql": true
    }
  }
  ```

  Enables GraphQL support with GraphiQL

  ```json
  {
    "core": {
      ...
      "graphql": {
        "graphiql": true
      }
    }
  }
  ```

  It's possible to selectively ignore entites:

  ```json
  {
    "core": {
      ...
      "graphql": {
        "ignore": {
          "categories": true
        }
      }
    }
  }
  ```

  It's possible to selectively ignore fields:

  ```json
  {
    "core": {
      ...
      "graphql": {
        "ignore": {
          "categories": {
            "name": true
          }
        }
      }
    }
  }
  ```
- **`openapi`** (`boolean` or `object`, default: `true`) — Enables OpenAPI REST support.
  - If value is an object, all [OpenAPI v3](https://swagger.io/specification/) allowed properties can be passed. Also a `prefix` property can be passed to set the OpenAPI prefix.
  - Platformatic DB uses [`@fastify/swagger`](https://github.com/fastify/fastify-swagger) under the hood to manage this configuration.

  _Examples_

  Enables OpenAPI

  ```json
  {
    "core": {
      ...
      "openapi": true
    }
  }
  ```

  Enables OpenAPI with prefix

  ```json
  {
    "core": {
      ...
      "openapi": {
        "prefix": "/api"
      }
    }
  }
  ```

  Enables OpenAPI with options

  ```json
  {
    "core": {
      ...
      "openapi": {
        "info": {
          "title": "Platformatic DB",
          "description": "Exposing a SQL database as REST"
        }
      }
    }
  }
  ```

  It's possible to selectively ignore entites:

  ```json
  {
    "core": {
      ...
      "openapi": {
        "ignore": {
          "categories": true
        }
      }
    }
  }
  ```

  It's possible to selectively ignore fields:

  ```json
  {
    "core": {
      ...
      "openapi": {
        "ignore": {
          "categories": {
            "name": true
          }
        }
      }
    }
  }
  ```

- **`ignore`** (`object`) — Key/value object that defines which database tables should not be mapped as API entities.

  _Examples_

  ```json
  {
    "core": {
      ...
      "ignore": {
        "versions": true // "versions" table will be not mapped with GraphQL/REST APIs
      }
    }
  }
  ```

- **`events`** (`boolean` or `object`, default: `true`) — Controls the support for events published by the SQL mapping layer.
  If enabled, this option add support for GraphQL Subscription over WebSocket. By default it uses an in-process message broker.
  It's possible to configure it to use Redis instead.

  _Examples_

  ```json
  {
    "core": {
      ...
      "events": {
        "connectionString": "redis://:password@redishost.com:6380/"
      }
    }
  }
  ```

### `dashboard`

This setting can be a `boolean` or an `object`. If set to `true` the dashboard will be served at the root path (`/`).

Supported object properties:

- **`rootPath`** (`boolean`, default: `true`) — Make the dashboard available at the root path (`/`).

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

### `migrations`

Configures [Postgrator](https://github.com/rickbergfalk/postgrator) to run migrations against the database.

An optional object with the following settings:

- **`dir`** (**required**, `string`): Relative path to the migrations directory.
- **`autoApply`** (`boolean`, default: `false`): Automatically apply migrations when Platformatic DB server starts.

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
      "hotReload": true
    }
  }
  ```

:::warning
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
- **`pluginTimeout`** (`integer`) -- the milliseconds to wait for a Fastify plugin to load, see the [fastify docs](https://www.fastify.io/docs/latest/Reference/Server/#plugintimeout) for more details.

### `authorization`

An optional object with the following settings:

- `adminSecret` (`string`): A secret that will be required as a password to
access the Platformatic DB dashboard. This secret can also be sent in an
`x-platformatic-admin-secret` HTTP header when performing GraphQL/REST API
calls. Use an [environment variable placeholder](#environment-variable-placeholders)
to securely provide the value for this setting.
- `roleKey` (`string`, default: `X-PLATFORMATIC-ROLE`): The name of the key in user
  metadata that is used to store the user's roles. See [Role configuration](/docs/reference/db/authorization/user-roles-metadata#role-configuration).
- `anonymousRole` (`string`, default: `anonymous`): The name of the anonymous role. See [Role configuration](/docs/reference/db/authorization/user-roles-metadata#role-configuration).
- `jwt` (`object`): Configuration for the [JWT authorization strategy](/docs/reference/db/authorization/strategies#json-web-token-jwt).
  Any option accepted by [`@fastify/jwt`](https://github.com/fastify/fastify-jwt)
  can be passed in this object.
  - `secret` (required, `string` or `object`): The secret key that the JWT was signed with.
  See the [`@fastify/jwt` documentation](https://github.com/fastify/fastify-jwt#secret-required)
  for accepted string and object values. Use an [environment variable placeholder](#environment-variable-placeholders)
  to securely provide the value for this setting.
  - `jwks` (`boolean` or `object`): Configure authorization with JSON Web Key Sets (JWKS). See the [JWKS documentation](/docs/reference/db/authorization/strategies#json-web-key-sets-jwks).
  - `namespace` (`string`): Configure a [JWT Custom Claim Namespace](/docs/reference/db/authorization/strategies#jwt-custom-claim-namespace)
    to avoid name collisions.
- `webhook` (`object`): Configuration for the [Webhook authorization strategy](/docs/reference/db/authorization/strategies#webhook).
  - `url` (required, `string`): Webhook URL that Platformatic DB will make a
  POST request to.
- `rules` (`array`): Authorization rules that describe the CRUD actions that
  users are allowed to perform against entities. See [Rules](/docs/reference/db/authorization/rules)
  documentation.

:::note
If an `authorization` object is present, but no rules are specified, no CRUD
operations are allowed unless `adminSecret` is passed.
:::

#### Example

```json title="platformatic.db.json"
{
  "authorization": {
    "jwt": {
      "secret": "{PLT_AUTHORIZATION_JWT_SECRET}"
    },
    "rules": [
       ...
    ]
  }
}
```

## Environment variable placeholders

The value for any configuration setting can be replaced with an environment variable
by adding a placeholder in the configuration file, for example `{PLT_SERVER_LOGGER_LEVEL}`.

All placeholders in a configuration must be available as an environment variable
and must meet the [allowed placeholder name](#allowed-placeholder-names) rules.

### Example

```json title="platformatic.db.json"
{
  "core": {
    "connectionString": "{DATABASE_URL}"
  },
  "server": {
    "logger": {
      "level": "{PLT_SERVER_LOGGER_LEVEL}"
    },
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
PLT_SERVER_LOGGER_LEVEL=debug npx platformatic db
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
npx platformatic db --allow-env=HOST,SERVER_LOGGER_LEVEL
```

If `--allow-env` is passed as an option to the CLI, it will be merged with the
default allow list.

## Sample Configuration

This is a bare minimum configuration for Platformatic DB. Uses a local `./db.sqlite` SQLite database, with OpenAPI and GraphQL support, and with the dashboard enabled.

Server will listen to `http://127.0.0.1:3042`

```json
{
  "server": {
    "hostname": "127.0.0.1",
    "port": "3042"
  },
  "core": {
    "connectionString": "'sqlite://./db.sqlite'",
    "graphiql": true,
    "openapi": true,
    "graphql": true
  },
  "dashboard": true
}
```
