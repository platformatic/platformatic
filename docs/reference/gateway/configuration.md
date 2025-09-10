import Issues from '../../getting-started/issues.md';

# Configuration

Platformatic Gateway can be configured with a [configuration file](#configuration-files) in the different file formats below. The Gateway also supports use of environment variables as setting values with [environment variable placeholders](../gateway/configuration.md#setting-and-using-env-placeholders).

## Configuration Files

Platformatic will automatically detect and load configuration files found in the current working directory with the file names listed [here](../../file-formats.md#configuration-files).

## Supported File Formats

For detailed information on supported file formats and extensions, visit our [Supported File Formats and Extensions](../../file-formats.md#supported-file-formats) page

## Configuration Settings

Configuration file settings are grouped as follows:

- **`basePath`** **(required)**: Configures the [basePath](../service/configuration.md#basePath).
- **`server`** **(required)**: Configures the [server settings](../service/configuration.md#server)
- **`gateway`**: Specific settings for Platformatic Gateway, such as application management and API composition.
- **`plugins`**: Manages additional functionality through [plugins](../service/configuration.md#plugins).
- **`telemetry`**: Handles [telemetry data reporting](../service/configuration.md#telemetry).
- **`watch`**: Observes file changes for [dynamic updates](../service/configuration.md#watch).

Sensitive data within these settings should use [configuration placeholders](#configuration-placeholders) to ensure security.

### Gateway

Configure `@platformatic/gateway` specific settings such as `applications` or `refreshTimeout`:

- **`applications`** (`array`, default: `[]`) — is an array of objects that defines
  the applications managed by the gateway. Each application object supports the following settings:
  - **`id`** (**required**, `string`) - A unique identifier for the application. Use a Platformatic Runtime application id if the application is executing inside [Platformatic Runtime context](../runtime/overview.md#platformatic-runtime-context).
  - **`origin`** (`string`) - A service origin. Skip this option if the service is executing inside [Platformatic Runtime context](../runtime/overview.md#platformatic-runtime-context). In this case, application `id` will be used instead of origin.
  - **`openapi`** (`object`) - The configuration file used to compose [OpenAPI](#openapi) specification.
  - **`graphql`** (`object`) - The configuration for the [GraphQL](#graphql) application.
  - **`proxy`** (`object` or `false`) - Service proxy configuration. If `false`, the application proxy is disabled.
    - `prefix` (`string`) - Service proxy prefix. All application routes will be prefixed with this value.
    - `hostname` (`string`) - An additional domain name this application is reachable at. It will be matched against requests' `Host` header.

    :::note
    If the prefix is not explicitly set, the gateway and the application will try to find the best prefix for the application.

    First of all, if the application code used the `platformatic.setBasePath` (which is always available in each application),
    then the value will become the application prefix.

    The next attempt will be to let the application autodetect its own prefix by using the configuration (as the `basePath` setting for `@platformatic/service`)
    or by autodetecting the prefix from the host application (like Next.js).

    When none of the criteria above successfully lead to a prefix, the application ID is chosen as last fallback to ensure there are not routing conflicts.
    :::

- **`openapi`** (`object`) - See the Platformatic Service [openapi](../service/configuration.md#service) option for more details.
- **`graphql`** (`object`) - Has the Platformatic Service [graphql](../service//configuration.md#service) options, plus
  - **`addEntitiesResolvers`** (`boolean`) - Automatically add related entities on GraphQL types, following the applications entities configuration. See [graphql-composer entities](https://github.com/platformatic/graphql-composer#gateway-entities) for details.
  - **`defaultArgsAdapter`** (`function` or `string`) - The default `argsAdapter` function for the entities, for example for the `@platformatic/db` mapped entities queries.

  ```js
  graphql: {
    defaultArgsAdapter: partialResults => ({ where: { id: { in: partialResults.map(r => r.id) } } })
  }
  ```

  or with the [metaline](https://github.com/platformatic/metaline) syntax, especially in the case of using the json configuration.

  ```json
  "defaultArgsAdapter": "where.id.in.$>#id"
  ```

  - **`onSubgraphError`** (`function`) - Hook called when an error occurs getting schema from a subgraph. The arguments are:
    - `error` (`error`) - The error message
    - `subgraphName` (`string`) - The erroring subgraph

    It's important to note GraphQL subscriptions are not supported in the gateway yet.

- **`refreshTimeout`** (`number`) - The number of milliseconds to wait for check for changes in the applications. If not specified, the default value is `1000`; set to `0` to disable. This is only supported if the Gateway is running within a [Platformatic Runtime](../runtime/overview.md).

- **`addEmptySchema`** (`boolean`) - If true, the gateway will add an empty response schema to the composed OpenAPI specification. Default is `false`.

### OpenAPI

- **`url`** (`string`) - A path of the route that exposes the OpenAPI specification. If an application is a Platformatic Service or Platformatic DB, use `/documentation/json` as a value. Use this or `file` option to specify the OpenAPI specification.
- **`file`** (`string`) - A path to the OpenAPI specification file. Use this or `url` option to specify the OpenAPI specification.
- **`prefix`** (`string`) - A prefix for the OpenAPI specification. All application routes will be prefixed with this value.
- **`config`** (`string`) - A path to the OpenAPI configuration file. This file is used to customize the [OpenAPI](#openapi-configuration)specification.

### OpenAPI Configuration

The OpenAPI configuration file is a JSON file that is used to customize the OpenAPI specification. It supports the following options:

- **`ignore`** (`boolean`) - If `true`, the route will be ignored by the gateway.
  If you want to ignore a specific method, use the `ignore` option in the nested method object.

  ```json title="Example JSON object"
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

  ```json title="Example JSON object"
  {
    "paths": {
      "/users": {
        "alias": "/customers"
      }
    }
  }
  ```

- **`rename`** (`string`) - Use it to rename composed route response fields.
  Use json schema format to describe the response structure, this only for `200` response.

  ```json title="Example JSON object"
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

  Composition of two remote applications:

  ```json title="Example JSON object"
  {
    "gateway": {
      "applications": [
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

  Composition of two local applications inside Platformatic Runtime:

  ```json title="Example JSON object"
  {
    "gateway": {
      "applications": [
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

### GraphQL

- **`host`** (`string`) - application host; if not specified, the `application.origin` is used.
- **`name`** (`string`) - name to identify the application. If not specified, the `application.origin` is used.
- **`graphqlEndpoint`** (`string`) - The graphql endpoint path, the default value is the common `'/graphql'`.
- **`composeEndpoint`** (`string`) - The endpoint to retrieve the introspection query from, default is `'/.well-known/graphql-composition'`. In case the endpoint is not available, a second call with introspection query will be sent to the `graphqlEndpoint`.
- **`entities`** (`object`) - Configuration object for working with entities in this subgraph, the values are objects with the following schema:
  - **`resolver`** (`object`) - The resolver to retrieve a list of objects - should return a list - and should accept as an arguments a list of primary keys or foreign keys.
    - **`name`** (`string`, **required**) - The name of the resolver.
    - **`argsAdapter (partialResults)`** (`function` or `string`) - The function invoked with a subset of the result of the initial query, where `partialResults` is an array of the parent node. It should return an object to be used as argument for `resolver` query. Can be a function or a [metaline](https://github.com/platformatic/metaline) string.
      **Default:** if missing, the `defaultArgsAdapter` function will be used; if that is missing too, a [generic one](lib/utils.js#L3) will be used.
    - **`partialResults`** (`function` or `string`) - The function to adapt the subset of the result to be passed to `argsAdapter` - usually is needed only on resolvers of `fkeys` and `many`. Can be a function or a [metaline](https://github.com/platformatic/metaline) string.
  - **`pkey`** (`string`, **required**) - The primary key field to identify the entity.
  - **`fkeys`** (`array of objects`) an array to describe the foreign keys of the entities, for example `fkeys: [{ type: 'Author', field: 'authorId' }]`.
    - **`type`** (`string`, **required**) - The entity type the foreign key is referred to.
    - **`field`** (`string`) - The foreign key field.
    - **`as`** (`string`) - When using `addEntitiesResolvers`, it defines the name of the foreign entity as a field of the current one, as a single type.
    - **`pkey`** (`string`) - The primary key of the foreign entity.
    - **`subgraph`** (`string`) - The subgraph name of the foreign entity, where the resolver is located; if missing is intended the self.
    - **`resolver`** (object) - The resolver definition to query the foreign entity, same structure as `entity.resolver`.
  - **`many`** (`array of objects`) - Describe a 1-to-many relation - the reverse of the foreign key.
    - **`type`** (`string`, **required**) - The entity type where the entity is a foreign key.
    - **`fkey`** (`string`, **required**) - The foreign key field in the referred entity.
    - **`as`** (`string`, **required**) - When using `addEntitiesResolvers`, it defines the name of the relation as a field of the current one, as a list.
    - **`pkey`** (`string`) - The primary key of the referred entity.
    - **`subgraph`** (`string`) - The subgraph name of the referred entity, where the resolver is located; if missing is intended the self.
    - **`resolver`** (`object`, **required**) - The resolver definition to query the referred entity, same structure as `entity.resolver`.

## Configuration References

### `telemetry`

Telemetry involves the collection and analysis of data generated by the operations of applications. See our [telemetry documentation](../service/configuration.md#telemetry) for details on configuring telemetry for Platformatic Service.

### `watch`

The `watch` functionality helps in monitoring file changes and dynamically updating applications. Learn more at Platformatic Service [watch](../service/configuration.md#watch)

## Setting and Using ENV placeholders

Environment variable placeholders are used to securely inject runtime configurations. Learn how to [set](../service/configuration.md#setting-environment-variables) and [use](../service/configuration.md#environment-variable-placeholders) environment variable placeholders [documentation](../service/configuration.md).

### PLT_ROOT

The [PLT_ROOT](../service/configuration.md#plt_root) variable is used to configure relative path and is set to the directory containing the Service configuration file.

<Issues />
