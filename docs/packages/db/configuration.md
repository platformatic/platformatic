import Issues from '../../getting-started/issues.md';

# Configuration 

Platformatic DB can be configured with a [configuration file](#configuration-file) in the different file formats below. The DB also support the use of environment variables as setting values with [environment variable placeholders](#environment-variable-placeholders). 

## Supported File Formats

For detailed information on supported file formats and extensions, please visit our [Supported File Formats and Extensions](../file-formats.md#supported-file-formats) page.

## Configuration Settings

Configuration file settings are grouped as follows:

- **`basePath`** **(required)**: Configures the [basePath](../service/configuration.md#basePath).
- **`server`** **(required)**: Configures the [server settings](../service/configuration.md#server)
- **`composer`**: Specific settings for Platformatic Composer, such as service management and API composition.
- **`metrics`**: Monitors and records performance [metrics](../service/configuration.md#metrics).
- **`plugins`**: Manages additional functionality through [plugins](../service/configuration.md#plugins).
- **`telemetry`**: Handles [telemetry data reporting](../service/configuration.md#telemetry).
- **`watch`**: Observes file changes for [dynamic updates](../service/configuration.md#watch).
- **`clients`**: Configures [client-specific](../service/configuration.md#clients) settings. 

Sensitive data within these settings should use [configuration placeholders](#configuration-placeholders) to ensure security.


### `db`

A **required** object with the following settings:

- **`connectionString`** (**required**, `string`) — Specifies the URL for database connection.

```json title="Example"
postgres://user:password@my-database:5432/db-name
```

- **`schema`** (array of `string`) - Defines the database schemas, only supported for PostgreSQL. Defaults to 'public' if unspecified.

```json title="Example Object"
  "db": {
    "connectionString": "(...)",
    "schema": [
      "schema1", "schema2"
    ],
    ...

  },

```

  - Platformatic DB supports MySQL, MariaDB, PostgreSQL and SQLite.
- **`graphql`** (`boolean` or `object`, default: `true`) — Controls the GraphQL API interface, with optional GraphQL API interface.

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
  - If value is an object, all [OpenAPI v3](https://swagger.io/specification/) allowed properties can be passed. Also, a `prefix` property can be passed to set the OpenAPI prefix.
  - Platformatic DB uses [`@fastify/swagger`](https://github.com/fastify/fastify-swagger) under the hood to manage this configuration.

  Enables OpenAPI

  ```json title="Example Object"
  {
    "db": {
      ...
      "openapi": true
    }
  }
  ```

  Enables OpenAPI using the `enabled` option

  ```json title="Example Object"
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

  ```json title="Example Object"
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

  ```json title="Example Object"
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
  We're adding a Bearer token in the form of a [JWT](./authorization/strategies.md#json-web-token-jwt) in the code block below: 

  ```json title="Example Object"
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

  You can selectively ignore entities:

  ```json title="Example Object"
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

  Selectively ignore fields:

  ```json title="Example Object"
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

  You can explicitly identify tables to build an entity, **however all other tables will be ignored**:

  ```json title="Example Object"
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

- **`allowPrimaryKeysInInput`** (`boolean`) - Allow the user to set the primary keys when creating new entities.

- **`poolSize`** (`number`, default: `10`) — Maximum number of connections in the connection pool.

- **`idleTimeoutMilliseconds`** (`number`, default: `30000`) - Max milliseconds a client can go unused before it is removed from the pool and destroyed.

- **`queueTimeoutMilliseconds`** (`number`, default: `60000`) - Number of milliseconds to wait for a connection from the connection pool before throwing a timeout error.

- **`acquireLockTimeoutMilliseconds`** (`number`, default: `60000`) - Number of milliseconds to wait for a lock on a connection/transaction.

- **`limit`** (`object`) - Set the default and max limit for pagination. Default is 10, max is 1000.


  ```json title="Example Object"
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

  ```json title="Example Object"
  {
    "db": {
      ...
      "ignore": {
        "versions": true // "versions" table will be not mapped with GraphQL/REST APIs
      }
    }
  }
  ```
- **`include`** (`object`) — Key/value object that defines which entities should be exposed.

  ```json title="Example Object"
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
  - `enabled`: Set to `true` to activate event publishing, which  support for GraphQL Subscription over WebSocket using an in-process message broker.
  - Custom Broker: To use an external message broker, such as Valkey, provide the connection string as shown in the example below.

  ```json title="Example Object"
  {
    "db": {
      ...
      "events": {
        ...
        "enabled": true,
         "connectionString": "valkey://:password@valkeyhost.com:6380/"
      }
    }
  }
  ```

- **`schemalock`** (`boolean` or `object`, default: `false`) — Controls the caching of the database schema on disk.
  Enabling this feature (`true`) saves the database schema metadata in a `schema.lock` file, ensuring faster startup times and consistent schema enforcement across sessions. You can also customize the storage location of the `schema.lock` file by providing a specific file path:

  ```json title="Example Object"
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


### `migrations`

Configures [Postgrator](https://github.com/rickbergfalk/postgrator) to run migrations against the database.

An optional object with the following settings:

- **`dir`** (**required**, `string`): Relative path to the migrations directory.
- **`autoApply`** (`boolean`, default: `false`): Automatically apply migrations when Platformatic DB server starts.
- **`table`** (`string`, default: `versions`): Table created to track schema version
- **`validateChecksums`** (`boolean`): Validates checksum of existing SQL migration files already run prior to executing migrations. Unused for JS migrations.
- **`newline`** (`string`): Force line ending on file when generating checksum. Value should be either CRLF (windows) or LF (unix/mac).
- **`currentSchema`** (`string`): For Postgres and MS SQL Server(will ignore for another DBs). Specifies schema to look to when validating `versions` table columns. For Postgres, run `SET search_path = currentSchema` prior to running queries against db. 

### `authorization`

An optional object with the following settings:

- `adminSecret` (`string`): A secret that should be sent in an
`x-platformatic-admin-secret` HTTP header when performing GraphQL/REST API
calls. Use an [environment variable placeholder](#environment-variable-placeholders)
to securely provide the value for this setting.
- `roleKey` (`string`, default: `X-PLATFORMATIC-ROLE`): The name of the key in user metadata that is used to store the user's roles. See [Role configuration](../db/authorization/user-roles-metadata.md#role-configuration)
- `rolePath` (`string`): The name of the dot-separated path in user
  metadata that is used to store the user's roles. See [Role configuration](../db/authorization/user-roles-metadata.md#role-configuration).
- `anonymousRole` (`string`, default: `anonymous`): The name of the anonymous role. See [Role configuration](../db/authorization/user-roles-metadata.md#role-configuration).
- `jwt` (`object`): Configuration for the [JWT authorization strategy](../db/authorization/strategies.md#json-web-token-jwt).
  Any option accepted by [`@fastify/jwt`](https://github.com/fastify/fastify-jwt)
  can be passed in this object.
  - `secret` (required, `string` or `object`): The secret key that the JWT was signed with.
  See the [`@fastify/jwt` documentation](https://github.com/fastify/fastify-jwt#secret-required)
  for accepted string and object values. Use an [environment variable placeholder](#environment-variable-placeholders)
  to securely provide the value for this setting.
  - `jwks` (`boolean` or `object`): Configure authorization with JSON Web Key Sets (JWKS). See the [JWKS documentation](../db/authorization/strategies.md#json-web-key-sets-jwks). 
  - `namespace` (`string`): Configure a [JWT Custom Claim Namespace](../db/authorization/strategies.md#jwt-custom-claim-namespace) to
    avoid name collisions. 
- `webhook` (`object`): Configuration for the [Webhook authorization strategy](../db/authorization/strategies.md#webhook).
  - `url` (required, `string`): Webhook URL that Platformatic DB will make a
  POST request to.
- `rules` (`array`): Authorization rules that describe the CRUD actions that
  users are allowed to perform against entities. See [Rules](../db/authorization/rules.md)
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

## Setting and Using ENV placeholders

Environment variable placeholders are used to securely inject runtime configurations. Learn how to [set](../service/configuration.md#setting-environment-variables) and [use](../service/configuration.md#environment-variable-placeholders) environment variable placeholders [documentation](../service/configuration.md).

### PLT_ROOT

The [PLT_ROOT](../service/configuration.md#plt_root) variable is used to configure relative path and is set to the directory containing the Service configuration file.

## Sample Configuration

The example below is a basic setup for Platformatic DB using a local SQLite database. It includes support for OpenAPI, GraphQL, and the GraphiQL interface.

The server is configured to listen on `http://127.0.0.1:3042`:

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

<Issues />
 
