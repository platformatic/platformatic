import Issues from '../../getting-started/issues.md';

# Configuration

Platformatic Next is configured with a configuration file. It supports the use
of environment variables as setting values with [configuration placeholders](#configuration-placeholders).

## `application`

Supported object properties:

- **`basePath`**: Service proxy base path when exposing this application in a [composer](../../composer/configuration.md) when setting the `proxy` property. If not specified, the service will be exposed on the service or a value specified in the service code via `platformatic.setBasePath()`.
- **`outputDirectory`**: The subdirectory where production build is stored at when using `wattpm build` or `plt build`. The default is `dist`.
- **`include`**: The paths to include when deploying the service. The default is `['dist']`.
- **`commands`**: An object specifying the commands to manage the application instead of using the Next defaults. Supported commands are:
  - **`install`**: The command to execute to install the service dependencies. The default is `npm ci --omit-dev`.
  - **`build`**: The command to execute to build the application.
  - **`development`**: The command to execute to start the application in development mode.
  - **`production`**: The command to execute to start the application in production mode.

## `logger`

Configures the logger, see the [logger configuration](https://www.fastify.io/docs/latest/Reference/Server/#logger) for more information.

## `server`

Configures the HTTP server, see the [runtime](../../runtime/configuration.md#server) documentation.

## `watch`

Manages watching of the service, see the [service](../../service/configuration.md#watch) documentation.

<Issues />
