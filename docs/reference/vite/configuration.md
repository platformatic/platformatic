import Issues from '../../getting-started/issues.md';
import RuntimeInCapabilities from '../_runtime-in-capabilities.md';

# Configuration

Platformatic Vite is configured with a configuration file. It supports the use
of environment variables as setting values with [configuration placeholders](#configuration-placeholders).

## `application`

Supported object properties:

- **`basePath`**: Service proxy base path when exposing this application in a [gateway](../gateway/configuration.md) when setting the `proxy` property. If not specified, the application will be exposed on the `/$ID` (where `$ID` is the application ID) id or a value specified in the application code via `platformatic.setBasePath()`.
- **`outputDirectory`**: The subdirectory where production build is stored at when using `wattpm build` or `plt build`. The default is `dist`.
- **`include`**: The paths to include when deploying the application. The default is `['dist']`.
- **`commands`**: An object specifying the commands to manage the application instead of using the Vite defaults. Supported commands are:
  - **`install`**: The command to execute to install the application dependencies. The default is `npm ci --omit-dev`.
  - **`build`**: The command to execute to build the application.
  - **`development`**: The command to execute to start the application in development mode.
  - **`production`**: The command to execute to start the application in production mode.
- **`changeDirectoryBeforeExecution`**: If set to `true`, change the current working directory to the application root before running any of the commands above. The default is `false`.
- **`preferLocalCommands`**: If set to `true`, resolve non-absolute commands from the application's `node_modules/.bin` before checking the current working directory. The default is `true`.

## `vite`

Configures Vite. Supported object properties:

- **`configFile`**: The configuration file path or `false` to disable autodetection.
- **`devServer.strict`**: Restrict serving files outside of workspace root. By default is `false`.
- **`ssr`**: Configures the application as SSR. Supported object properties:
  - **`enabled`**: If the application is a SSR application.
  - **`entrypoint`**: The application entrypoint file. The default is `server.js`.
  - **`clientDirectory`**: The directory containing client files. The default is `client`.
  - **`serverDirectory`**: The directory containing server files. The default is `server`.
- **`preCompressed`**: Serves the pre-compressed sibling of a static file in a production build (`<file>.br`, `<file>.gz` and the other encodings supported by [`@fastify/static`](https://github.com/fastify/fastify-static#precompressed)) when the request's `Accept-Encoding` accepts it, with the `Content-Type` of the original file and `Vary: Accept-Encoding`. The build must write those files, for example with a Vite compression plugin. A file without a compressed sibling is served as is. It can be:
  - a boolean;
  - a string, such as a [configuration placeholder](#configuration-placeholders) (`"{PLT_VITE_PRECOMPRESSED}"`): any value but `"false"` turns it on;
  - an object with an **`enabled`** property, which takes the same values as an application's `enabled` in the [runtime](../runtime/configuration.md#applications): a boolean, a string as above, or an object of booleans by environment (`production`, `development`), enabled when it names none of them. `enabled` defaults to `true`.

  The default is `false`.

## `logger`

Configures the `logger`, see the [runtime](../runtime/configuration.md#logger) documentation.

## `server`

Configures the HTTP server, see the [runtime](../runtime/configuration.md#server) documentation.

## `watch`

Manages watching of the application, see the [application](../service/configuration.md#watch) documentation.

<RuntimeInCapabilities />

<Issues />
