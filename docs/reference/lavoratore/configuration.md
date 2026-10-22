import Issues from '../../getting-started/issues.md';
import RuntimeInCapabilities from '../_runtime-in-capabilities.md';

# Configuration

Platformatic Lavoratore is configured through a configuration file. It supports environment variables as setting values with [configuration placeholders](../service/configuration.md#environment-variable-placeholders).

## `application`

Supported object properties:

- **`basePath`**: Service proxy base path when exposing this application in a [gateway](../gateway/configuration.md) with the `proxy` property. If not specified, the application is exposed on `/$ID` (where `$ID` is the application ID), or on a value specified in application code via `platformatic.setBasePath()`.
- **`outputDirectory`**: Subdirectory Platformatic includes in deployments.
- **`include`**: Paths to include when deploying the application.
- **`commands`**: Object specifying commands to manage the application:
  - **`install`**: Command to install application dependencies. Default: `npm ci --omit-dev`.
  - **`build`**: Command to build the application, for instance to compile a TypeScript Worker.
  - **`development`**: Command to start the application in development mode, instead of running the Worker in Watt.
  - **`production`**: Command to start the application in production mode, instead of running the Worker in Watt.
- **`changeDirectoryBeforeExecution`**: If `true`, change the current working directory to the application root before running any of the commands above. Default: `false`.
- **`preferLocalCommands`**: If `true`, resolve non-absolute commands from the application's `node_modules/.bin` before checking the current working directory. Default: `true`.

## `lavoratore`

Configures the Worker.

Supported object properties:

- **`configFile`**: Path of the Wrangler configuration file, relative to the application root. Defaults to the first of `wrangler.json`, `wrangler.jsonc` and `wrangler.toml` found, if any.
- **`environment`**: The [Wrangler environment](https://developers.cloudflare.com/workers/wrangler/environments/) to use. As in Wrangler, bindings and `vars` are not inherited from the top level configuration.
- **`main`**: The Worker entrypoint, relative to the application root. Overrides `main` from the Wrangler configuration file. When missing in both, it is [autodetected](./overview.md#entrypoint).
- **`vars`**: Additional variables exposed via the `env` object. They take precedence over `vars` from the Wrangler configuration file and `.dev.vars`.
- **`services`**: Service bindings, as an object mapping the binding name to the ID of a Watt application. Merged with `services` from the Wrangler configuration file, taking precedence.
- **`crons`**: Cron expressions which invoke the `scheduled` handler. Overrides `triggers.crons` from the Wrangler configuration file.

## `logger`

Configures the `logger`. See [runtime logger](../runtime/configuration.md#logger).

## `server`

Configures the HTTP server. See [runtime server](../runtime/configuration.md#server).

`server.http2` is not supported.

## `watch`

Manages watching of the application. See [application watch](../service/configuration.md#watch). By default the `.wrangler` folder is ignored.

<RuntimeInCapabilities />

<Issues />
