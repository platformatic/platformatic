# Configuration

Platformatic DB is configured with a configuration file. It supports the use
of environment variables as setting values with [configuration placeholders](#configuration-placeholders).

## Configuration file

If the Platformatic CLI finds a file in the current working directory matching
one of these filenames, it will automatically load it:

- `platformatic.db.json`
- `platformatic.db.json5`
- `platformatic.db.yml` or `platformatic.db.yaml`
- `platformatic.db.tml`

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
- **`openapi`** (`boolean` or `object`, default: `true`) — Enables OpenAPI REST support.
  - If value is an object, all [OpenAPI v3](https://swagger.io/specification/) allowed properties can be passed.
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

### `dashboard`

An optional object with the following settings:

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
- **`autoApply`** (`boolean`, default: `true`): Automatically apply migrations when Platformatic DB server starts.

### `plugin`

An optional object that defines a plugin to be loaded with [`fastify-isolate`](https://github.com/mcollina/fastify-isolate):

- **`path`** (**required**, `string`): Relative path to plugin's entry point.

All properties will be passed to `fastify-isolate`.

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

### `authorization`

Authorization settings can be set with an optional `authorization` object, for example:

```json
  "authorization": {
    "adminSecret": "platformatic",
    "rules": [
       ...
    ]
  }
```

- **`adminSecret`** (`string`, optional) — If defined, it will be the password used to access the dashboard and the string to send within the `x-platformatic-admin-secret` header when performing GraphQL/REST API calls.
- **`rules`** (`array`) — Authorization rules that describe the CRUD actions that users are allowed to perform.

Note that if an `authorization` section is present, but _**no rules**_ are specified, no CRUD operations are allowed (unless `adminSecret` is passed).

#### Authorization rules

Every rule must specify:
- `role` — the role name. It's a string and must match with the role(s) set by the external authentication service
- `entity` — the Platformatic DB entity
- A set of optional [`defaults`](#defaults)
- One entry for each supported CRUD operation: `find`, `save`, `delete`

#### Operation options

Every operation can specify `checks` used for the authorizations.
This value can be `false` (operation disabled) or `true` (operation enabled with no checks).

To specify more fine-grained authorization controls, add a `checks` field, e.g.:

```json
{
  "role": "user",
  "entity": "page",
  "find": {
    "checks": {
      "userId": "X-PLATFORMATIC-USER-ID"
    }
  },
  ...
}

```

In this example, when a user with a `user` role executes a `findPage`, they can
access all the data that has `userId` equal to the value  in user metadata with
key `X-PLATFORMATIC-USER-ID`.

Note that `"userId": "X-PLATFORMATIC-USER-ID"` is syntactic sugar for:

```json
      "find": {
        "checks": {
          "userId": {
            "eq": "X-PLATFORMATIC-USER-ID"
          }
        }
      }
```

It's possible to specify more complex rules using all the [supported where clause operators](./sql-mapper/entities/api.md#where-clause).

Note that `userId` MUST exist as a field in the database table to use this feature.

#### Fields

If a `fields` array is present on an operation, Platformatic DB restricts the columns on which the user can execute to that list.
For `save` operations, the configuration must specify all the not-nullable fields (otherwise, it would fail at runtime).
Platformatic does these checks at startup.

Example:

```json
    "rule": {
        "entity": "page",
        "role": "user",
        "find": {
          "checks": {
            "userId": "X-PLATFORMATIC-USER-ID"
          },
          "fields": ["id", "title"]
        }
        ...
    }
```

In this case, only `id` and `title` are returned for a user with a `user` role on the `page` entity.

#### Defaults

Defaults are used in database insert and are default fields added automatically populated from user metadata, e.g.:

```json
        "defaults": {
          "userId": "X-PLATFORMATIC-USER-ID"
        },
```

When an entity is created, the `userId` column is used and populated using the value from user metadata.

#### Anonymous role

If a user has no role, the `anonymous` role is assigned automatically. It's possible to specify a rule for it:

```json
     {
        "role": "anonymous",
        "entity": "page",
        "find": false,
        "delete": false,
        "save": false
      }
```

In this case, the user that has no role (or has an explicitly `anonymous` role) has no operations allowed on the `page` entity.

#### Role and anonymous keys

The roles key in user metadata defaults to `X-PLATFORMATIC-ROLE`. It's possible to change it using the `roleKey` field in configuration.
Same for the `anonymous` role, which value can be changed using `anonymousRole`.

```json
 "authorization": {
    "roleKey": "X-MYCUSTOM-ROLE_KEY",
    "anonymousRole": "anonym",
    "rules": [
    ...
    ]
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
    "logger": {
      "level": "{PLT_SERVER_LOGGER_LEVEL}"
    },
    "connectionString": "{DATABASE_URL}"
  },
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
