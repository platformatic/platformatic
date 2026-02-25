import Issues from '../../getting-started/issues.md';
import RuntimeInCapabilities from '../_runtime-in-capabilities.md';

# Configuration

Platformatic Vinext is configured with a configuration file. It supports environment-variable placeholders like other Platformatic capabilities.

> ⚠️ **Experimental**: The Vinext capability is experimental and its configuration surface may evolve.

## `application`

Supported object properties:

- **`basePath`**: Service proxy base path when exposing this application through a [gateway](../gateway/configuration.md).
- **`outputDirectory`**: Build output directory for production builds. Default is `dist`.
- **`include`**: Paths included when deploying. Default is `['dist']`.
- **`commands`**: Optional command overrides:
  - **`install`**
  - **`build`**
  - **`development`**
  - **`production`**

## `vinext`

Vinext-specific options:

- **`configFile`**: Vite config file path (or `false` to disable autodetection).
- **`devServer.strict`**: Restrict serving files outside workspace root. Default is `false`.
- **`noCompression`**: Disable compression in production server mode. Default is `false`.

App Router detection is automatic (via `app/` or `src/app/`).

## `logger`

Configures application logging. See [runtime logger options](../runtime/configuration.md#logger).

## `server`

Configures HTTP server options. See [runtime server options](../runtime/configuration.md#server).

## `watch`

Watch behavior for the application. See [watch configuration](../service/configuration.md#watch).

<RuntimeInCapabilities />

<Issues />
