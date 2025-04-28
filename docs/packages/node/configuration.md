import Issues from '../../getting-started/issues.md';

# Configuration

Platformatic Node is configured with a configuration file. It supports the use
of environment variables as setting values with [configuration placeholders](#configuration-placeholders).

## `application`

Supported object properties:

- **`basePath`**: Service proxy base path when exposing this application in a [composer](../../composer/configuration.md) when setting the `proxy` property. If not specified, the service will be exposed on the service or a value specified in the service code via `platformatic.setBasePath()`.
- **`outputDirectory`**: The subdirectory where production build is stored at when using `wattpm build` or `plt build`. The default is `dist`.
- **`include`**: The paths to include when deploying the service. The default is `['dist']`.
- **`commands`**: An object specifying the commands to manage the application instead of directly executing the service entrypoint. Supported commands are:
  - **`install`**: The command to execute to install the service dependencies. The default is `npm ci --omit-dev`.
  - **`build`**: The command to execute to build the application.
  - **`development`**: The command to execute to start the application in development mode.
  - **`production`**: The command to execute to start the application in production mode.

## `node`

Configures Node. Supported object properties:

- **`main`**: The entrypoint of the application. This is only needed if the `main` property is not set in the service `package.json` file.
- **`absoluteUrl`**: If set to `true`, then the service will receive the full URL from a Platformatic Composer. The default is `false`.
- **`dispatchViaHttp`**: If set to `true`, then the service will serve requests coming from the mesh network via a TCP port.
- **`disablePlatformaticInBuild`**: If set to `true`, then no Platformatic code will be started when running the `build` command.

## `logger`

Configures the `logger`, see the [runtime](../../runtime/configuration.md#logger) documentation.

## `server`

Configures the HTTP server, see the [runtime](../../runtime/configuration.md#server) documentation.

## `watch`

Manages watching of the service, see the [service](../../service/configuration.md#watch) documentation.

<Issues />
