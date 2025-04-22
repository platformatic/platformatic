# Logger Configuration

Platformatic provides robust logging capabilities built on [Pino](https://getpino.io/), offering various configuration options to customize the logs.

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

- **`transport`**: Configure different transports to improve logs visualization and destination.

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

## Inheritance

In Platformatic applications, logger configuration can be inherited from parent configurations. When a service is part of a composed application or a runtime application, the logger configuration is inherited from the parent unless explicitly overridden. This ensures consistent logging behavior across the entire application, and allows for different logging configurations for specific services needs; so usually you will only need to configure the logger for the `watt.json` config file.

## Examples

### Basic Configuration

`platformatic.service.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/service/1.0.0.json",
  "logger": {
    "level": "info"
  }
}
```

### Advanced Configuration

`platformatic.application.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/node/2.60.0.json",
  "logger": {
    "level": "debug",
    "transport": {
      "targets": [
        {
          "target": "pino-pretty",
          "options": {
            "colorize": true
          }
        },
        {
          "target": "pino/file",
          "options": {
            "destination": "{LOG_DIR}/app.log",
            "mkdir": true
          },
          "level": "error"
        }
      ]
    },
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

