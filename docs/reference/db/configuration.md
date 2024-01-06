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

- [`server`](#server) **(required)**
- [`db`](#db) **(required)**
- [`metrics`](#metrics)
- [`migrations`](#migrations)
- [`plugins`](#plugins)
- [`authorization`](#authorization)
- [`telemetry`](#telemetry)
- [`watch`](#watch)
- [`clients`](#clients)

Sensitive configuration settings, such as a database connection URL that contains
a password, should be set using [configuration placeholders](#configuration-placeholders).

### `server`

See [Platformatic Service server](/docs/reference/service/configuration.md#server) for more details.

### `db`

A **required** object with the following settings:

- **`connectionString`** (**required**, `string`) — Database connection URL.
  - Example: `postgres://user:password@my-database:5432/db-name`

- ** `schema`** (array of `string`) - Currently supported only for postgres, schemas used tolook for entities. If not provided, the default `public` schema is used.

 _Examples_

```json
  "db": {
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
    "db": {
      ...
      "graphql": true
    }
  }
  ```

  Enables GraphQL support with the `enabled` option

  ```json
  {
    "db": {
      ...
      "graphql": {
        ...
        "enabled": true
      }
    }
  }
  ```

  Enables GraphQL support with GraphiQL

  ```json
  {
    "db": {
      ...
      "graphql": {
        "graphiql": true
      }
    }
  }
  ```

  It's possible to selectively ignore entities:

  ```json
  {
    "db": {
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
    "db": {
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

  It's possible to add a custom GraphQL schema during the startup:

  ```json
  {
    "db": {
      ...
      "graphql": {
        "schemaPath": "path/to/schema.graphql"
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
    "db": {
      ...
      "openapi": true
    }
  }
  ```

  Enables OpenAPI using the `enabled` option

  ```json
  {
    "db": {
      ...
      "openapi": {
        ...
        "enabled": true
      }
    }
  }
  ```

  Enables OpenAPI with prefix

  ```json
  {
    "db": {
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
    "db": {
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

  You can for example add the `security` section, so that Swagger will allow you to add the authentication header to your requests.
  In the following code snippet, we're adding a Bearer token in the form of a [JWT](/reference/db/authorization/strategies.md#json-web-token-jwt):
  ```json
  {
    "db": {
      ...
      "openapi": {
        ...
        "security": [{ "bearerAuth": [] }],
        "components": {
          "securitySchemes": {
            "bearerAuth": {
              "type": "http",
              "scheme": "bearer",
              "bearerFormat": "JWT"
            }
          }
        }
      }
    }
  }
  ```

  It's possible to selectively ignore entities:

  ```json
  {
    "db": {
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
    "db": {
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

  It's possible to explicitly identify tables for which you like to build an entity:
  **Note**: all other tables will be ignored.

  ```json
  {
    "db": {
      ...
      "openapi": {
        "include": {
          "categories": true
        }
      }
    }
  }
  ```
- **`autoTimestamp`** (`boolean` or `object`) - Generate timestamp automatically when inserting/updating records.

- **`poolSize`** (`number`, default: `10`) — Maximum number of connections in the connection pool.

- **`idleTimeoutMilliseconds`** (`number`, default: `30000`) - Max milliseconds a client can go unused before it is removed from the pool and destroyed.

- **`queueTimeoutMilliseconds`** (`number`, default: `60000`) - Number of milliseconds to wait for a connection from the connection pool before throwing a timeout error.

- **`acquireLockTimeoutMilliseconds`** (`number`, default: `60000`) - Number of milliseconds to wait for a lock on a connection/transaction.

- **`limit`** (`object`) - Set the default and max limit for pagination. Default is 10, max is 1000.

  _Examples_

  ```json
  {
    "db": {
      ...
      "limit": {
        "default": 10,
        "max": 1000
      }
    }
  }
  ```

- **`ignore`** (`object`) — Key/value object that defines which database tables should not be mapped as API entities.

  _Examples_

  ```json
  {
    "db": {
      ...
      "ignore": {
        "versions": true // "versions" table will be not mapped with GraphQL/REST APIs
      }
    }
  }
  ```
- **`include`** (`object`) — Key/value object that defines which database tables should be mapped as API entities.

  _Examples_

  ```json
  {
    "db": {
      ...
      "include": {
        "version": true
      }
    }
  }
  ```

- **`events`** (`boolean` or `object`, default: `true`) — Controls the support for events published by the SQL mapping layer.
  If enabled, this option add support for GraphQL Subscription over WebSocket. By default it uses an in-process message broker.
  It's possible to configure it to use Redis instead.

  _Examples_

  Enable events using the `enabled` option.

  ```json
  {
    "db": {
      ...
      "events": {
        ...
        "enabled": true
      }
    }
  }
  ```

  ```json
  {
    "db": {
      ...
      "events": {
        "connectionString": "redis://:password@redishost.com:6380/"
      }
    }
  }
  ```

- **`schemalock`** (`boolean` or `object`, default: `false`) — Controls the caching of the database schema on disk.
  If set to `true` the database schema metadata is stored inside a `schema.lock` file.
  It's also possible to configure the location of that file by specifying a path, like so:

  _Examples_

  ```json
  {
    "db": {
      ...
      "schemalock": {
        "path": "./dbmetadata"
      }
    }
  }
  ```

  Starting Platformatic DB or running a migration will automatically create the schemalock file.


### `metrics`

See [Platformatic Service metrics](/docs/reference/service/configuration.md#metrics) for more details.

### `migrations`

Configures [Postgrator](https://github.com/rickbergfalk/postgrator) to run migrations against the database.

An optional object with the following settings:

- **`dir`** (**required**, `string`): Relative path to the migrations directory.
- **`autoApply`** (`boolean`, default: `false`): Automatically apply migrations when Platformatic DB server starts.

### `plugins`

See [Platformatic Service plugins](/docs/reference/service/configuration.md#plugins) for more details.

### `watch`

See [Platformatic Service watch](/docs/reference/service/configuration.md#watch) for more details.

### `authorization`

An optional object with the following settings:

- `adminSecret` (`string`): A secret that should be sent in an
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

### `telemetry`

See [Platformatic Service telemetry](/docs/reference/service/configuration.md#telemetry) for more details.

### `watch`

See [Platformatic Service watch](/docs/reference/service/configuration.md#watch) for more details.

### `clients`

See [Platformatic Service clients](/docs/reference/service/configuration.md#clients) for more details.

## Environment variable placeholders

See [Environment variable placeholders](/docs/reference/service/configuration.md#environment-variable-placeholders) for more details.

### Setting environment variables

See [Setting environment variables](/docs/reference/service/configuration.md#setting-environment-variables) for more details.

### Allowed placeholder names

See [Allowed placeholder names](/docs/reference/service/configuration.md#allowed-placeholder-names) for more details.

### PLT_ROOT

The `{PLT_ROOT}` placeholder is automatically set to the directory containing the configuration file, so it can be used to configure relative paths.

## Sample Configuration

This is a bare minimum configuration for Platformatic DB. Uses a local `./db.sqlite` SQLite database, with OpenAPI and GraphQL support.

Server will listen to `http://127.0.0.1:3042`

```json
{
  "server": {
    "hostname": "127.0.0.1",
    "port": "3042"
  },
  "db": {
    "connectionString": "sqlite://./db.sqlite",
    "graphiql": true,
    "openapi": true,
    "graphql": true
  }
}
```


 
