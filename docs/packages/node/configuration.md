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

Configures the logger, see the [logger configuration](https://www.fastify.io/docs/latest/Reference/Server/#logger) for more information.

Additionally to the [logger configuration](https://www.fastify.io/docs/latest/Reference/Server/#logger), the following properties are supported:

- **`formatters`**: specifying the formatters to use for the logger, for `bindings` and `level`, following the [pino formatters](https://github.com/pinojs/pino/blob/main/docs/api.md#formatters-object). The functions must be specified and exported in a separate ESM file and referenced with the `path` property.
- **`timestamp`**: the timestamp format to use for the logs, one of:
  - `isoTime`
  - `epochTime`
  - `unixTime`
  - `nullTime`
- **`redact`**: specify the `paths` and optionally the `censor` for redactions, see [pino redact](https://github.com/pinojs/pino/blob/main/docs/api.md#redact-array--object).

Example:

`platformatic.application.json`

``` json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/2.60.0.json",
  "logger": {
    "formatters": {
      "path": "formatters.js",
    },
    "timestamp": "isoTime",
    "redact": {
      "censor": "[redacted]",
      "paths": ["secret", "req.headers.authorization"]
    }
  }
}
```

`formatters.js`

``` js
export function bindings (bindings) {
  return { service: 'service-name' }
}

export function level (label) {
  return { level: label.toUpperCase() }
}
```

Alternatively, `formatters.bindings` and `redact` can be specified deriving from the `globalThis.platformatic.logger` object as follows; note that the `timestamp` and `formatters.level` are not supported in this case.

```js
const app = fastify({
  loggerInstance: globalThis.platformatic.logger.child({ service: 'app1' },
    {
      formatters: {
        bindings: (bindings) => {
          return { name: bindings.service }
        },
      },
      redact: {
        paths: ['secret'],
        censor: '***HIDDEN***'
      }
    })
})
```

## `server`

Configures the HTTP server, see the [runtime](../../runtime/configuration.md#server) documentation.

## `watch`

Manages watching of the service, see the [service](../../service/configuration.md#watch) documentation.

<Issues />
