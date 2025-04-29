# Logger Configuration

Platformatic provides robust logging capabilities built on [Pino](https://getpino.io/), offering various configuration options to customize the logs for every kind of Platformatic service.

The default logger configuration is `level: info` and `transport: pino-pretty` when running in a terminal or in development mode.

The typical usage is to set the `logger` options in the `watt.json` configuration file and have them consistent across all services, since the logger configuration is inherited from the parent configurations to the child services, but the settings can be overridden in the `platformatic.json` configuration file for specific services.

## Options

The logger configuration supports the following properties:

- **`level`**: (default: `'info'`) The minimum level to log. Available values include:
  - `'fatal'` - only fatal errors
  - `'error'` - fatal and error messages
  - `'warn'` - errors, warnings, and less severe issues
  - `'info'` - general information, plus all above levels (default)
  - `'debug'` - detailed information for debugging, plus all above levels
  - `'trace'` - very detailed tracing information, plus all above levels
  - `'silent'` - no logging at all

  See the [Pino documentation](https://github.com/pinojs/pino/blob/main/docs/api.md#level-string) for more details.

- **`transport`**: The default transport will output logs to stdout and stderr; for specific need different transports can be set, usually to collect logs to a specific destination.

This can be configured in two ways:
  
  - Single transport:
    ```json
    {
      "transport": {
        "targets": [{
          "target": "pino-elasticsearch",
          "options": {
            "node": "http://127.0.0.1:9200"
          }
        }
    }
    ```
    
  - Multiple transports:
    ```json
    {
      "transport": {
        "targets": [
          {
            "target": "pino-pretty",
            "level": "info",
            "options": {
              "colorize": true
            }
          },
          {
            "target": "pino/file",
            "level": "error",
            "options": {
              "destination": "{LOG_DIR}/app.log",
              "mkdir": true
            }
          }
        ]
      }
    }
    ```

  See the [Pino transports documentation](https://github.com/pinojs/pino/blob/main/docs/transports.md) for more details.

- **`formatters`**: Specify custom formatters for the logger, for `bindings` and `level`. Functions must be exported in a separate ESM file and referenced with the `path` property:

  ```json
  {
    "formatters": {
      "path": "formatters.js"
    }
  }
  ```

  The `formatters.js` file must export two functions: `bindings` and `level`.

  ```js
  export function bindings (bindings) {
    return { service: 'service-name' }
  }

  export function level (label) {
    return { level: label.toUpperCase() }
  }
  ```

  See the [Pino formatters documentation](https://github.com/pinojs/pino/blob/main/docs/api.md#formatters-object) for more details.

- **`timestamp`**: The timestamp format to use for the logs, one of:
  - `isoTime` - ISO 8601-formatted time string
  - `epochTime` - milliseconds since Unix epoch (default for Pino)
  - `unixTime` - seconds since Unix epoch
  - `nullTime` - no timestamp

  See the [Pino time functions documentation](https://github.com/pinojs/pino/blob/main/docs/api.md#pino-stdtimefunctions) for more details.

- **`redact`**: Specify the `paths` and optionally the `censor` for redacting sensitive information:

  ```json
  {
    "redact": {
      "paths": ["req.headers.authorization", "password"],
      "censor": "[redacted]"
    }
  }
  ```

  The `censor` property defaults to `"[redacted]"` if not specified.

  See the [Pino redaction documentation](https://github.com/pinojs/pino/blob/main/docs/redaction.md) for more details.

### Using Environment Variables

You can use environment variables in your logger configuration:

```json
{
  "logger": {
    "level": "{LOG_LEVEL}",
    "transport": {
      "target": "pino/file",
      "options": {
        "destination": "{LOG_DIR}/service.log",
        "mkdir": true
      }
    }
  }
}
```

---

## Examples

### Full options configuration

A `platformatic.json` configuration file contains the following logger options will look like this:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/2.60.0.json",
  "logger": {
    "level": "debug",
    "formatters": {
      "path": "formatters.js"
    },
    "timestamp": "isoTime",
    "redact": {
      "censor": "[redacted]",
      "paths": ["secret", "req.headers.authorization"]
    }
  }
}
```

`formatters.js`:

```js
export function bindings (bindings) {
  return { service: 'service-name' }
}

export function level (label) {
  return { level: label.toUpperCase() }
}
```

In this example, the logger is configured run a `@platformatic/node` service, but the same configuration can be used for any other Platformatic service.
In this example, the logger is configured to use a file transport and the `level` is set to `debug`.

## Programmatic Usage

When using Platformatic programmatically, you can derive from the `globalThis.platformatic.logger` object as follows:

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

Note that the `timestamp` and `formatters.level` are not supported when using the logger programmatically in this way.

---

## Setting up a Platformatic application with logging configuration

Let's see an example of a Platformatic application with `watt`, `composer`, `backend` based on `@platformatic/node` and `frontend` based on `@platformatic/next` services, the application is available in the `docs/guides/logger` directory.

The main `watt` service has a shared logger configuration that is used by all the services, it sets the timestamp in ISO format and the level in uppercase. Setting it in the `watt` service ensures that the logs will be consistent across all the services.

`watt.json`

```json
{
  "$schema": "https://schemas.platformatic.dev/wattpm/2.61.0.json",
  "server": {
    "hostname": "{HOSTNAME}",
    "port": "{PORT}"
  },
  "logger": {
    "level": "info",
    "timestamp": "isoTime"
  },
  "autoload": {
    "path": "services"
  }
}
```

The other services have their own logger configuration, for example the `backend` service has a redaction configuration

`backend/platformatic.json`

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/2.61.0.json",
  "logger": {
    "level": "debug",
    "redact": {
      "paths": [
        "req.headers.authorization"
      ],
      "censor": "***HIDDEN***"
    }
  }
}
```

In the `node` application the logger is available as `globalThis.platformatic.logger`, for example

`backend/src/app.js`

```js
import fastify from 'fastify'

const app = fastify({
  loggerInstance: globalThis.platformatic.logger
})
```


The `next` service has a custom formatter that adds the `service` property to the logs, note the service level is different in the services.

`next/platformatic.json`

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/2.60.0.json",
  "application": {
    "basePath": "/next"    
  },
  "logger": {
    "level": "debug"
  }
}
```

Then in the  `next` application the logger is available as `globalThis.platformatic.logger`, for example

`next/src/app/page.jsx`

```jsx
export default function Home() {
  globalThis.platformatic.logger?.debug('Home page called')

  return (
    <main>
      <div>Hello World!</div>
    </main>
  )
}
```