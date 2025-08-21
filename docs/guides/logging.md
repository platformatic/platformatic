# How to Configure Logging in Your Watt Application

## Problem

You need to customize logging behavior in your Platformatic application for different environments (development, staging, production) or integrate with external logging systems.

## Solution Overview

Platformatic uses [Pino](https://getpino.io/) for high-performance logging with extensive configuration options. You can:
- Set consistent logging across all applications via Watt configuration
- Override logging for specific applications
- Integrate with external systems (Elasticsearch, files, etc.)
- Redact sensitive information from logs

The default configuration uses `level: info` with pretty-printed output in development.

## Quick Solutions by Use Case

**Need to change log level?** → [Set Log Level](#set-log-level)  
**Need to log to files?** → [File Logging](#file-logging)  
**Need to hide sensitive data?** → [Redact Sensitive Information](#redact-sensitive-information)  
**Need structured production logs?** → [Production Logging](#production-logging)

## Set Log Level

**Problem:** You need different amounts of logging detail in different environments.

**Solution:** Configure the `level` property in your `watt.json`:

```json
{
  "logger": {
    "level": "debug"
  }
}
```

**Available levels (most to least verbose):**
- `trace` - Very detailed debugging information
- `debug` - Debugging information  
- `info` - General information (default)
- `warn` - Warning messages
- `error` - Error messages only
- `fatal` - Fatal errors only
- `silent` - No logging

**Environment-specific example:**
```json
{
  "logger": {
    "level": "{LOG_LEVEL}"
  }
}
```

Set `LOG_LEVEL=error` in production, `LOG_LEVEL=debug` in development.

## File Logging

**Problem:** You need to persist logs to files for auditing or analysis.

**Solution:** Configure a file transport in your `watt.json`:

```json
{
  "logger": {
    "transport": {
      "targets": [{
        "target": "pino/file",
        "options": {
          "destination": "{LOG_DIR}/app.log",
          "mkdir": true
        }
      }]
    }
  }
}
```

**Multiple destinations example:**
```json
{
  "logger": {
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
            "destination": "{LOG_DIR}/errors.log",
            "mkdir": true
          }
        }
      ]
    }
  }
}
```

This logs all messages to console with pretty formatting, and errors to a file.

## External System Integration

**Problem:** You need to send logs to Elasticsearch, Splunk, or other logging systems.

**Solution:** Use specialized transport targets:

**Elasticsearch:**
```json
{
  "logger": {
    "transport": {
      "targets": [{
        "target": "pino-elasticsearch",
        "options": {
          "node": "http://127.0.0.1:9200",
          "index": "my-app-logs"
        }
      }]
    }
  }
}
```

Install the transport: `npm install pino-elasticsearch`

## Redact Sensitive Information

**Problem:** Your logs contain sensitive data (passwords, tokens, API keys) that shouldn't be stored.

**Solution:** Use the `redact` configuration to automatically hide sensitive fields:

```json
{
  "logger": {
    "redact": {
      "paths": [
        "req.headers.authorization",
        "password", 
        "apiKey",
        "req.body.creditCard"
      ],
      "censor": "[REDACTED]"
    }
  }
}
```

**Before redaction:**
```json
{
  "level": 30,
  "msg": "User login",
  "password": "secret123",
  "req": {
    "headers": {
      "authorization": "Bearer token123"
    }
  }
}
```

**After redaction:**
```json
{
  "level": 30,
  "msg": "User login", 
  "password": "[REDACTED]",
  "req": {
    "headers": {
      "authorization": "[REDACTED]"
    }
  }
}
```

## Production Logging

**Problem:** You need structured, machine-readable logs for production monitoring.

**Solution:** Configure production-optimized logging:

```json
{
  "logger": {
    "level": "info",
    "timestamp": "isoTime",
    "base": {
      "service": "my-app",
      "version": "1.2.0"
    },
    "redact": {
      "paths": ["req.headers.authorization", "password"]
    }
  }
}
```

This provides:
- ISO timestamp format for log aggregation
- Service metadata for filtering
- Automatic sensitive data redaction

- **base**: The base object for the logs; it can be either be `null` to remove `pid` and `hostname` or a custom key/value object to add custom properties to the logs.

  ```json
  {
    "logger": {
      "base": {
        "service": "my-service",
        "version": "1.0.0"
      }
    }
  }

  {
    "logger": {
      "base": null
    }
  }
  ```

  See the [Pino base documentation](https://github.com/pinojs/pino/blob/main/docs/api.md#base-object) for more details.

- **messageKey**: The key to use for the log message, it defaults to `msg` but can be set to any other key.

  ```json
  {
    "logger": {
      "messageKey": "message"
    }
  }
  ```

  See the [Pino messageKey documentation](https://github.com/pinojs/pino/blob/main/docs/api.md#messagekey-string) for more details.

- **customLevels**: Specify custom levels for the logger, it can be an object with the level name and the level value.

  ```json
  {
    "logger": {
      "customLevels": {
        "verbose": 10
      }
    }
  }
  ```

  See the [Pino customLevels documentation](https://github.com/pinojs/pino/blob/main/docs/api.md#customlevels-object) for more details.

---

### Note on using custom logger configuration

When using custom logger configuration that alterate the format of the output, such as `messageKey`, `formatter.level`, `timestamp` or `customLevels`, the log entry from a thread service is not recognized as a `pino` entry log entry, so it is treated as a json log entry.

For example, the difference between the default pino settings and a custom logger configuration that uses a custom `messageKey` is:

With default pino settings:

```json
{
  "level": 30,
  "time": 1747988551789,
  "pid": 29580,
  "hostname": "work",
  "name": "composer",
  "reqId": "c9f5d5b8-6ea5-4782-8c81-00ffb27386b3",
  "res": { "statusCode": 500 },
  "responseTime": 10.037883000448346,
  "msg": "request completed"
}
```

With custom logger configuration, for example 

```json
{
  "logger": {
    "captureStdio": false,
    "level": "info",
    "customLevels": {
      "verbose": 10
    },
    "base": null,
    "messageKey": "message",
    "timestamp": "isoTime",
    "formatters": {
      "path": "logger-formatters.js"
    }
  }
}
```

```json
{
  "severity": "INFO",
  "time": "2025-05-23T08:20:51.464Z",
  "name": "composer",
  "caller": "STDOUT",
  "stdout": {
    "severity": "INFO",
    "time": "2025-05-23T08:20:51.464Z",
    "name": "composer",
    "reqId": "420ab3ab-aa5f-42d4-9736-d941cfaaf514",
    "res": {
      "statusCode": 200
    },
    "responseTime": 10.712485999800265,
    "message": "request completed"
  }
}
```

To avoid the log entry to be wrapped in the `stdout` property, set the `captureStdio` option in `wattpm` to `false` (see [Capture Thread Services logs](#capture-thread-services-logs) for more details); the result will be close to the default pino settings:

```json
{
  "severity": "INFO",
  "time": "2025-05-23T08:21:49.813Z",
  "name": "composer",
  "reqId": "4a8ad43d-f749-4993-a1f4-3055c55b23ba",
  "res": {
    "statusCode": 200
  },
  "responseTime": 11.091869999654591,
  "message": "request completed"
}
```

---

### Capture Thread Applications logs

By default, Platformatic applications logs are captured by Watt and wrapped in the `stdout` and `stderr` streams, for example:

```txt
{"level":"info","time":1747840934509,"pid":23381,"hostname":"work","name":"node","caller":"STDOUT","stdout":{"level":"info","time":1747840934509,"pid":23381,"hostname":"work","name":"node","reqId":"req-1","req":{"method":"GET","url":"/","host":"node.plt.local"},"msg":"incoming request"}}
```

The `captureStdio` option in `wattpm` can be set to `false` to disable the capture of the logs of the child applications; in this case logs will be written directly to the `stdout` and `stderr` streams of Watt.

`watt.json`

```json
{
  "logger": {
    "captureStdio": false
  }
}
```

So the previous log output will be

```txt
{"level":"info","time":1747840934509,"pid":23381,"hostname":"work","name":"node","reqId":"req-1","req":{"method":"GET","url":"/","host":"node.plt.local"},"msg":"incoming request"}
```

Note the log is the content of the `stdout` property.

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

In this example, the logger is configured run a `@platformatic/node` application, but the same configuration can be used for any other Platformatic application.
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

Let's see an example of a Platformatic application with `watt`, `composer`, `backend` based on `@platformatic/node` and `frontend` based on `@platformatic/next` applications, the application is available in the `docs/guides/logger` directory.

Watt has a shared logger configuration that is used by all the applications, it sets the timestamp in ISO format and the level in uppercase. Setting it in Watt ensures that the logs will be consistent across all the applications.

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

The other applications have their own logger configuration, for example the `backend` application has a redaction configuration

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


The `next` application has a custom formatter that adds the `application` property to the logs, note the application level is different in the applications.

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