import Issues from '../../getting-started/issues.md';

# Configuration

Platformatic Next is configured with a configuration file. It supports the use
of environment variables as setting values with [configuration placeholders](#configuration-placeholders).

## `application`

Supported object properties:

- **`basePath`**: Service proxy base path when exposing this application in a [composer](../../composer/configuration.md) when setting the `proxy` property. If not specified, the service will be exposed on the `/$ID` (where `$ID` is the service ID) id or a value specified in the service code via `platformatic.setBasePath()`.
- **`outputDirectory`**: The subdirectory where production build is stored at when using `wattpm build` or `plt build`. The default is `dist`.
- **`include`**: The paths to include when deploying the service. The default is `['dist']`.
- **`commands`**: An object specifying the commands to manage the application instead of using the Next defaults. Supported commands are:
  - **`install`**: The command to execute to install the service dependencies. The default is `npm ci --omit-dev`.
  - **`build`**: The command to execute to build the application.
  - **`development`**: The command to execute to start the application in development mode.
  - **`production`**: The command to execute to start the application in production mode.

## `logger`

Configures the `logger`, see the [runtime](../../runtime/configuration.md#logger) documentation.

## `server`

Configures the HTTP server, see the [runtime](../../runtime/configuration.md#server) documentation.

## `watch`

Manages watching of the service, see the [service](../../service/configuration.md#watch) documentation.

## `cache`

Configures an [Incremental Server Rendering cache](https://nextjs.org/docs/app/api-reference/next-config-js/incrementalCacheHandlerPath) handler.

Supported object properties:

- **`adapter`**: The adapter to use. The only supported value is `valkey` (of which `redis` is a synonym).
- **`url`**: The URL of the Valkey/Redis server.
- **`prefix`**: The prefix to use for all cache keys.
- **`maxTTL`**: The maximum life of a server key, in seconds. If the Next.js `revalidate` value is greater than this value, then
  the adapter will refresh the key expire time as long as it is accessed every `maxTTL` seconds. The default value is `604800` (one week).

## `next`

Configures Next.js. Supported object properties:

- **`trailingSlash`**: Enables [trailingSlash](https://nextjs.org/docs/pages/api-reference/config/next-config-js/trailingSlash) in the `next.config.js`.

<Issues />
