import Issues from '../../getting-started/issues.md';
import RuntimeInCapabilities from '../\_runtime-in-capabilities.md';

# Configuration

Platformatic Node is configured with a configuration file. It supports the use
of environment variables as setting values with [configuration placeholders](#configuration-placeholders).

## `application`

Supported object properties:

- **`basePath`**: Service proxy base path when exposing this application in a [gateway](../gateway/configuration.md) when setting the `proxy` property. If not specified, the application will be exposed on the application or a value specified in the application code via `platformatic.setBasePath()`.
- **`outputDirectory`**: The subdirectory where production build is stored at when using `wattpm build` or `plt build`. The default is `dist`.
- **`include`**: The paths to include when deploying the application. The default is `['dist']`.
- **`commands`**: An object specifying the commands to manage the application instead of directly executing the application entrypoint. Supported commands are:
  - **`install`**: The command to execute to install the application dependencies. The default is `npm ci --omit-dev`.
  - **`build`**: The command to execute to build the application.
  - **`development`**: The command to execute to start the application in development mode.
  - **`production`**: The command to execute to start the application in production mode.
- **`changeDirectoryBeforeExecution`**: If set to `true`, change the current working directory to the application root before running any of the commands above. The default is `false`.
- **`preferLocalCommands`**: If set to `true`, resolve non-absolute commands from the application's `node_modules/.bin` before checking the current working directory. The default is `true`.
- **`entrypointPort`**: The main port the application will listen on. If not provided, it will use the port of the first TCP server that the application starts. This setting should be provided only if the application starts multiple TCP servers and the main one is not the first that actually listens on a port.
- **`processSpawner`**: Path to a custom module used to spawn application processes.
  The module must export an async or sync `spawn(executable, args, options, stdout, stderr)` function that will receive the following arguments:
  - **`executable`**: Command executable.
  - **`args`**: Array of command arguments.
  - **`options`**: `child_process.spawn` options.
  - **`stdout`** and **`stderr`**: Writable streams where process output should be piped with `{ end: false }` and set to UTF-8 encoding.

  The function must return a `ChildProcess` instance (or a `Promise` that resolves to one), after the "spawn" event has been triggered.

## `node`

Configures Node. Supported object properties:

- **`main`**: The entrypoint of the application. This is only needed if the `main` property is not set in the application `package.json` file.
- **`absoluteUrl`**: If set to `true`, then the application will receive the full URL from a Platformatic Gateway. The default is `false`.
- **`dispatchViaHttp`**: If set to `true`, then the application will serve requests coming from the mesh network via a TCP port.
- **`disableBuildInDevelopment`**: If set to `true`, it will not automatically build an application in development mode.
- **`disablePlatformaticInBuild`**: If set to `true`, then no Platformatic code will be started when running the `build` command.
- **`hasServer`**: If set to `false`, then Platformatic Node will treat the application as a background application which doesn't expose any HTTP port.

## `logger`

Configures the `logger`, see the [runtime](../runtime/configuration.md#logger) documentation.

## `server`

Configures the HTTP server, see the [runtime](../runtime/configuration.md#server) documentation.

## `watch`

Manages watching of the application, see the [service](../service/configuration.md#watch) documentation.

<RuntimeInCapabilities />

<Issues />
