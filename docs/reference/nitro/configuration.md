import Issues from '../../getting-started/issues.md';
import RuntimeInCapabilities from '../_runtime-in-capabilities.md';

# Configuration

Platformatic Nitro is configured through a configuration file. It supports environment variables as setting values with [configuration placeholders](#configuration-placeholders).

## `application`

Supported object properties:

- **`basePath`**: Service proxy base path when exposing this application in a [gateway](../gateway/configuration.md) with the `proxy` property. If not specified, the application is exposed on `/$ID` (where `$ID` is the application ID), or on a value specified in application code via `platformatic.setBasePath()`.
- **`outputDirectory`**: Subdirectory Platformatic includes in deployments and uses as the default location of the Nitro production output. Default: `.output`.
- **`include`**: Paths to include when deploying the application. Defaults to the effective Nitro output directory.
- **`commands`**: Object specifying commands to manage the application instead of Nitro defaults:
  - **`install`**: Command to install application dependencies. Default: `npm ci --omit-dev`.
  - **`build`**: Command to build the application.
  - **`development`**: Command to start the application in development mode.
  - **`production`**: Command to start the application in production mode.
- **`changeDirectoryBeforeExecution`**: If `true`, change the current working directory to the application root before running any of the commands above. Default: `false`.
- **`preferLocalCommands`**: If `true`, resolve non-absolute commands from the application's `node_modules/.bin` before checking the current working directory. Default: `true`.

## `nitro`

Configures Nitro-specific Platformatic behavior.

Supported object properties:

- **`outputDirectory`**: Directory containing the Nitro production output. Defaults to `application.outputDirectory`, which is `.output` unless configured.
- **`entrypoint`**: Server entrypoint relative to `nitro.outputDirectory`. Default: `server/index.mjs`.

:::note
Platformatic Nitro uses `nitro.outputDirectory` and `nitro.entrypoint` to locate the generated server. When changing the output directory, configure Nitro's `output.dir` to write to the same path. Unless explicitly configured, `application.include` follows the effective Nitro output directory.
:::

## `vite`

Configures Vite options used by the development server when Nitro is used as a Vite plugin. Platformatic Nitro supports `configFile` and `devServer` from the [Platformatic Vite configuration](../vite/configuration.md#vite). Set `configFile` to `false` to force standalone Nitro mode.

This is useful for development server settings such as allowing mesh-network hostnames:

```json
{
  "vite": {
    "devServer": {
      "strict": false
    }
  }
}
```

## `logger`

Configures the `logger`. See [runtime logger](../runtime/configuration.md#logger).

## `server`

Configures the HTTP server. See [runtime server](../runtime/configuration.md#server).

`server.http2` is not supported because Nitro creates its own HTTP server. In standalone Nitropack development, TLS keys and certificates must each use a single `{ "path": "..." }` value.

## `watch`

Manages watching of the application. See [application watch](../service/configuration.md#watch).

<RuntimeInCapabilities />

<Issues />
