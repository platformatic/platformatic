# Configuration

Platformatic Composer configured with a configuration file. It supports the use
of environment variables as setting values with [configuration placeholders](#configuration-placeholders).

## Configuration file

If the Platformatic CLI finds a file in the current working directory matching
one of these filenames, it will automatically load it:

- `platformatic.composer.json`
- `platformatic.composer.json5`
- `platformatic.composer.yml` or `platformatic.composer.yaml`
- `platformatic.composer.tml` or `platformatic.composer.toml`

Alternatively, a [`--config` option](/reference/cli.md#composer) with a configuration
filepath can be passed to most `platformatic composer` CLI commands.

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
- [`composer`](#composer)
- [`metrics`](#metrics)
- [`plugins`](#plugins)
- [`telemetry`](#telemetry)
- [`watch`](#watch)
- [`clients`](#clients)

Sensitive configuration settings containing sensitive data should be set using [configuration placeholders](#configuration-placeholders).

### `server`

See [Platformatic Service server](/docs/reference/service/configuration.md#server) for more details.

### `metrics`

See [Platformatic Service metrics](/docs/reference/service/configuration.md#metrics) for more details.

### `plugins`

See [Platformatic Service plugins](/docs/reference/service/configuration.md#plugins) for more details.

### `composer`

Configure `@platformatic/composer` specific settings such as `services` or `refreshTimeout`:

- **`services`** (`array`, default: `[]`) — is an array of objects that defines
the services managed by the composer. Each service object supports the following settings:

  - **`id`** (**required**, `string`) - A unique identifier for the service. Use a Platformatic Runtime service id if the service is executing inside of [Platformatic Runtime context](/docs/reference/runtime/introduction.md#platformatic-runtime-context).
  - **`origin`** (`string`) - A service origin. Skip this option if the service is executing inside of [Platformatic Runtime context](/docs/reference/runtime/introduction.md#platformatic-runtime-context). In this case, service id will be used instead of origin.
  - **`openapi`** (`object`) - The configuration file used to compose OpenAPI specification. See the [openapi](#openapi) for details.
  - **`graphql`** (`object`) - The configuration for the GraphQL service. See the [graphql](#graphql) for details.
  - **`proxy`** (`object` or `false`) - Service proxy configuration. If `false`, the service proxy is disabled.
    - `prefix` (**required**, `string`) - Service proxy prefix. All service routes will be prefixed with this value.

- **`openapi`** (`object`) - See the Platformatic Service [service](/docs/reference/service/configuration.md#service) openapi option for details.
- **`graphql`** (`object`) - Has the Platformatic Service [service](/docs/reference/service/configuration.md#service) graphql options, plus
  - **`defaultArgsAdapter`** (`number`) - The default `argsAdapter` function for the entities, for example
  ```js
  graphql: {
    defaultArgsAdapter: (partialResults) => ({ where: { id: { in: partialResults.map(r => r.id) } } })
  }
  ```

- **`refreshTimeout`** (`number`) - The number of milliseconds to wait for check for changes in the service OpenAPI specification. If not specified, the default value is `1000`.

#### `openapi`

- **`url`** (`string`) - A path of the route that exposes the OpenAPI specification. If a service is a Platformatic Service or Platformatic DB, use `/documentation/json` as a value. Use this or `file` option to specify the OpenAPI specification.
- **`file`** (`string`) - A path to the OpenAPI specification file. Use this or `url` option to specify the OpenAPI specification.
- **`prefix`** (`string`) - A prefix for the OpenAPI specification. All service routes will be prefixed with this value.
- **`config`** (`string`) - A path to the OpenAPI configuration file. This file is used to customize the OpenAPI specification. See the [openapi-configuration](#openapi-configuration) for details.

##### `openapi-configuration`

The OpenAPI configuration file is a JSON file that is used to customize the OpenAPI specification. It supports the following options:

- **`ignore`** (`boolean`) - If `true`, the route will be ignored by the composer.
If you want to ignore a specific method, use the `ignore` option in the nested method object.

  _Example_

  ```json
  {
    "paths": {
      "/users": {
        "ignore": true
      },
      "/users/{id}": {
        "get": { "ignore": true },
        "put": { "ignore": true }
      }
    }
  }
  ```

- **alias** (`string`) - Use it create an alias for the route path. Original route path will be ignored.

  _Example_

  ```json
  {
    "paths": {
      "/users": {
        "alias": "/customers"
      }
    }
  }
  ```

- **`rename`** (`string`) - Use it to rename composed route response fields.
Use json schema format to describe the response structure. For now it works only for `200` response.

  _Example_

  ```json
  {
    "paths": {
      "/users": {
        "responses": {
            "200": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": { "rename": "user_id" },
                  "name": { "rename": "first_name" }
                }
              }
            }
          }
      }
    }
  }
  ```

_Examples_

  Composition of two remote services:

  ```json
  {
    "composer": {
      "services": [
        {
          "id": "auth-service",
          "origin": "https://auth-service.com",
          "openapi": {
            "url": "/documentation/json",
            "prefix": "auth"
          }
        },
        {
          "id": "payment-service",
          "origin": "https://payment-service.com",
          "openapi": {
            "file": "./schemas/payment-service.json"
          }
        }
      ],
      "refreshTimeout": 1000
    }
  }
  ```

  Composition of two local services inside of Platformatic Runtime:

  ```json
  {
    "composer": {
      "services": [
        {
          "id": "auth-service",
          "openapi": {
            "url": "/documentation/json",
            "prefix": "auth"
          }
        },
        {
          "id": "payment-service",
          "openapi": {
            "file": "./schemas/payment-service.json"
          }
        }
      ],
      "refreshTimeout": 1000
    }
  }
  ```

#### `graphql`

- **`host`** (`string`) - service host; if not specified, the `service.origin` is used.
- **`name`** (`string`) - name to identify the service. If not specified, the `service.origin` is used.
- **`graphqlEndpoint`** (`string`) - The graphql endpoint path, the default value is the common `'/graphql'`.
- **`composeEndpoint`** (`string`) - The endpoint to retrieve the introspection query from, default is `'/.well-known/graphql-composition'`. In case the endpoint is not available, a second call with introspection query will be sent to the `graphqlEndpoint`.
- **`entities`** (`Object`) - Configuration object for working with entities in the service. Each key in this object is the name of an entity data type. This is required if the service contains any entities. The values are objects with the the following schema:
  - `referenceListResolverName` (`string`) - The name of the resolver used to retrieve a list of objects by their keys. Can be optional if the entity doesn't have a resolver because its keys are nested in another entity (see the [example](./examples/with-nested-keys.js)).
  - `argsAdapter (partialResults)` (`function`) - When resolving an entity across multiple services, an initial query is made to one service followed by one or more followup queries to other services. The initial query must return enough information to identify the corresponding data in the other services. This function is invoked with the result of the initial query. It should return an object to be used as argument for `referenceListResolverName` query.
  **Default:** if missing, the `defaultArgsAdapter` function will be used.
  - `keys` (**required**, `Object[]`) - The keys of the entity, to identify itself or refered to other entities. The key format is `[{ field, type }]`, for example `[{ field: 'id', type: 'Book' }]`. `type` can be omitted referring to the entity itself.
  ```js
  entities: {
    Book: {
      referenceListResolverName: 'books',
      keys: [{ field: 'id' }, { field: 'authorId', type: 'Author' }]
      argsAdapter: (partialResults) => ({ where: { id: { in: partialResults.map(r => r.id) } } })
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
