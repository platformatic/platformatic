# How to Configure Logging in Your Watt Application

## Problem

You need to customize logging behavior in your Watt application for different environments (development, staging, production) or integrate with external logging systems

## Solution Overview

Watt uses [Pino](https://getpino.io/) for high-performance logging with extensive configuration options. You can:

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
**Need OpenTelemetry integration?** → [External System Integration](#external-system-integration) or [OpenTelemetry Logging Guide](./opentelemetry-logging.md)
**Need Sentry integration?** → [Sentry](#sentry)

## Set Log Level

**Problem:** You need different amounts of logging detail in different environments.

**Solution:** Configure the `level` property in your `watt.config.ts`:

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    level: 'debug'
  }
})
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

```ts config
import { defineConfig } from 'wattpm'

const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const

// `level` is a literal union, so the value is narrowed rather than cast: an unknown
// level is caught while you type instead of at boot.
const level = levels.find(candidate => candidate === process.env.LOG_LEVEL) ?? 'info'

export default defineConfig({
  logger: { level }
})
```

Set `LOG_LEVEL=error` in production, `LOG_LEVEL=debug` in development.

## File Logging

**Problem:** You need to persist logs to files for auditing or analysis.

**Solution:** Configure a file transport in your `watt.config.ts`:

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    transport: {
      targets: [
        {
          target: 'pino/file',
          options: {
            destination: `${process.env.LOG_DIR ?? './logs'}/app.log`,
            mkdir: true
          }
        }
      ]
    }
  }
})
```

**Multiple destinations example:**

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    transport: {
      targets: [
        {
          target: 'pino-pretty',
          level: 'info',
          options: {
            colorize: true
          }
        },
        {
          target: 'pino/file',
          level: 'error',
          options: {
            destination: `${process.env.LOG_DIR ?? './logs'}/errors.log`,
            mkdir: true
          }
        }
      ]
    }
  }
})
```

This logs all messages to console with pretty formatting, and errors to a file.

## External System Integration

**Problem:** You need to send logs to Elasticsearch, Splunk, OpenTelemetry collectors, or other logging systems.

**Solution:** Use specialized transport targets.

### OpenTelemetry (Recommended for Observability)

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    openTelemetryExporter: {
      protocol: 'http',
      url: 'http://localhost:4318/v1/logs'
    }
  },
  telemetry: {
    enabled: true,
    applicationName: 'my-app',
    version: '1.0.0',
    exporter: {
      type: 'otlp',
      options: {
        url: 'http://otel-collector:4318/v1/traces'
      }
    }
  }
})
```

This automatically:

- Exports logs to any OTLP-compatible backend
- Includes trace context (trace ID, span ID, flags)
- Adds service metadata for filtering

The trace exporter shown here uses OTLP over HTTP. Telemetry traces also support OTLP over gRPC with:

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  telemetry: {
    applicationName: 'my-app',
    exporter: {
      type: 'otlp',
      options: {
        protocol: 'grpc',
        url: 'http://otel-collector:4317'
      }
    }
  }
})
```

When using gRPC, do not include `/v1/traces` in the URL.

See the [OpenTelemetry Logging Guide](./opentelemetry-logging.md) for detailed configuration.

### Sentry

Watt can send runtime and application logs to [Sentry](https://sentry.io/) using [pino-sentry-transport](https://github.com/tomer-yechiel/pino-sentry-transport) as a Pino transport target.

Install the transport and the Sentry SDK in your application:

```bash
npm install pino-sentry-transport @sentry/node
```

Then add a Sentry target to `logger.transport.targets`:

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    level: 'info',
    transport: {
      targets: [
        {
          target: 'pino/file'
        },
        {
          target: 'pino-sentry-transport',
          options: {
            sentry: {
              dsn: process.env.SENTRY_DSN
            },
            withLogRecord: true,
            tags: ['level', 'name', 'worker', 'application'],
            context: ['err', 'req', 'url', 'method', 'application', 'worker']
          }
        }
      ]
    }
  }
})
```

The top-level `logger.level` controls which logs Watt emits. Each transport target can also define its own `level`, which controls which emitted logs that target receives. Set the Sentry target level explicitly if it should differ from Pino's transport target default.

Options inside `options.sentry` are passed to `@sentry/node` initialization. Use them for Sentry settings such as `dsn`, `environment`, `release`, or `tunnel`.

Use `minLevel` if you also want `pino-sentry-transport` to filter records internally:

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    level: 'debug',
    transport: {
      targets: [
        {
          target: 'pino-sentry-transport',
          level: 'debug',
          options: {
            sentry: {
              dsn: process.env.SENTRY_DSN
            },
            minLevel: 40
          }
        }
      ]
    }
  }
})
```

In this example, Watt emits `debug` and above, the Sentry transport target receives `debug` and above, and `pino-sentry-transport` sends only `warn` and above to Sentry.

### Elasticsearch

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    transport: {
      targets: [
        {
          target: 'pino-elasticsearch',
          options: {
            node: 'http://127.0.0.1:9200',
            index: 'my-app-logs'
          }
        }
      ]
    }
  }
})
```

Install the transport: `npm install pino-elasticsearch`

### AWS Cloudwatch

AWS Cloudwatch can use the timestamp from logs in the Cloudwatch and Cloudwatch
Insights dashboards. To do this, the timestamp format needs to be changed.

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    timestamp: 'isoTime'
  }
})
```

## Redact Sensitive Information

**Problem:** Your logs contain sensitive data (passwords, tokens, API keys) that shouldn't be stored.

**Solution:** Use the `redact` configuration to automatically hide sensitive fields:

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    redact: {
      paths: ['req.headers.authorization', 'password', 'apiKey', 'req.body.creditCard'],
      censor: '[REDACTED]'
    }
  }
})
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

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    level: 'info',
    timestamp: 'isoTime',
    base: {
      application: 'my-app',
      version: '1.2.0'
    },
    redact: {
      paths: ['req.headers.authorization', 'password']
    }
  }
})
```

This provides:

- ISO timestamp format for log aggregation
- Application metadata for filtering
- Automatic sensitive data redaction

- **base**: The base object for the logs; it can be either be `null` to remove `pid` and `hostname` or a custom key/value object to add custom properties to the logs.

  ```js
  logger: {
    base: {
      application: 'my-application',
      version: '1.0.0'
    }
  }

  logger: {
    base: null
  }
  ```

  See the [Pino base documentation](https://github.com/pinojs/pino/blob/main/docs/api.md#base-object) for more details.

- **messageKey**: The key to use for the log message, it defaults to `msg` but can be set to any other key.

  ```js
  logger: {
    messageKey: 'message'
  }
  ```

  See the [Pino messageKey documentation](https://github.com/pinojs/pino/blob/main/docs/api.md#messagekey-string) for more details.

- **customLevels**: Specify custom levels for the logger, it can be an object with the level name and the level value.

  ```js
  logger: {
    customLevels: {
      verbose: 10
    }
  }
  ```

  See the [Pino customLevels documentation](https://github.com/pinojs/pino/blob/main/docs/api.md#customlevels-object) for more details.

---

### Note on using custom logger configuration

When using custom logger configuration that changes the output keys, such as `messageKey`, `formatter.level`, `timestamp` or `customLevels`, configure `logger.pino` so Watt can still recognize Pino log entries emitted by thread applications.

For example, the difference between the default pino settings and a custom logger configuration that uses a custom `messageKey` is:

With default pino settings:

```json
{
  "level": 30,
  "time": 1747988551789,
  "pid": 29580,
  "hostname": "work",
  "name": "gateway",
  "reqId": "c9f5d5b8-6ea5-4782-8c81-00ffb27386b3",
  "res": { "statusCode": 500 },
  "responseTime": 10.037883000448346,
  "msg": "request completed"
}
```

With custom logger configuration, for example

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    captureStdio: false,
    level: 'info',
    customLevels: {
      verbose: 10
    },
    base: null,
    messageKey: 'message',
    timestamp: 'isoTime',
    formatters: {
      path: 'logger-formatters.js'
    }
  }
})
```

Set `logger.pino` to the keys emitted by your worker application logs:

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    pino: {
      level: 'severity',
      time: 'time',
      message: 'message'
    }
  }
})
```

By default, Watt uses `level`, `time` and `msg`. If the configured keys are not present, Watt treats the entry as a JSON log entry and wraps it in the `stdout` property:

```json
{
  "severity": "INFO",
  "time": "2025-05-23T08:20:51.464Z",
  "name": "gateway",
  "caller": "STDOUT",
  "stdout": {
    "severity": "INFO",
    "time": "2025-05-23T08:20:51.464Z",
    "name": "gateway",
    "reqId": "420ab3ab-aa5f-42d4-9736-d941cfaaf514",
    "res": {
      "statusCode": 200
    },
    "responseTime": 10.712485999800265,
    "message": "request completed"
  }
}
```

When the keys match `logger.pino`, the log entry is not wrapped in the `stdout` property. Alternatively, to avoid the log entry to be wrapped in the `stdout` property, set the `captureStdio` option in `wattpm` to `false` (see [Capture Thread Applications logs](#capture-thread-applications-logs) for more details); the result will be close to the default pino settings:

```json
{
  "severity": "INFO",
  "time": "2025-05-23T08:21:49.813Z",
  "name": "gateway",
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

By default, Watt applications logs are captured by Watt and wrapped in the `stdout` and `stderr` streams, for example:

```txt
{"level":"info","time":1747840934509,"pid":23381,"hostname":"work","name":"node","caller":"STDOUT","stdout":{"level":"info","time":1747840934509,"pid":23381,"hostname":"work","name":"node","reqId":"req-1","req":{"method":"GET","url":"/","host":"node.plt.local"},"msg":"incoming request"}}
```

The `captureStdio` option in `wattpm` can be set to `false` to disable the capture of the logs of the child applications; in this case logs will be written directly to the `stdout` and `stderr` streams of Watt.

`watt.config.ts`

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    captureStdio: false
  }
})
```

So the previous log output will be

```txt
{"level":"info","time":1747840934509,"pid":23381,"hostname":"work","name":"node","reqId":"req-1","req":{"method":"GET","url":"/","host":"node.plt.local"},"msg":"incoming request"}
```

Note the log is the content of the `stdout` property.

### Using Environment Variables

A configuration file is a program, so it reads the environment directly — there is no
`{PLACEHOLDER}` syntax:

```ts config
import { defineConfig } from 'wattpm'

const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const
const level = levels.find(candidate => candidate === process.env.LOG_LEVEL) ?? 'info'

export default defineConfig({
  logger: {
    level,
    transport: {
      target: 'pino/file',
      options: {
        destination: `${process.env.LOG_DIR ?? './logs'}/application.log`,
        mkdir: true
      }
    }
  }
})
```

---

## Examples

### Full options configuration

A `watt.config.ts` with those logger options looks like this:

```ts config
import { node } from '@platformatic/node'

export default node({
  logger: {
    level: 'debug',
    formatters: {
      path: 'formatters.js'
    },
    timestamp: 'isoTime',
    redact: {
      censor: '[redacted]',
      paths: ['secret', 'req.headers.authorization']
    }
  },
  server: { port: Number(process.env.PORT ?? 3042) }
})
```

`formatters.js`:

```js
export function bindings (bindings) {
  return { application: 'application-name' }
}

export function level (label) {
  return { level: label.toUpperCase() }
}
```

In this example, the logger is configured run a `@platformatic/node` application, but the same configuration can be used for any other Watt application.
In this example, the logger is configured to use a file transport and the `level` is set to `debug`.

## Programmatic Usage

When using Platformatic programmatically, you can derive from the logger returned by [`getLogger()`](../reference/runtime/globals.md#logging-and-observability) as follows:

```js
import { getLogger } from '@platformatic/globals'

const logger = getLogger()

const app = fastify({
  loggerInstance: logger.child(
    { application: 'app1' },
    {
      formatters: {
        bindings: bindings => {
          return { name: bindings.application }
        }
      },
      redact: {
        paths: ['secret'],
        censor: '***HIDDEN***'
      }
    }
  )
})
```

Note that the `timestamp` and `formatters.level` are not supported when using the logger programmatically in this way.

---

## Setting up a Watt application with logging configuration

Let's see an example of a Watt configuration with `gateway`, `backend` based on `@platformatic/node` and `frontend` based on `@platformatic/next` applications, the application is available in the `docs/guides/logger` directory.

The main `watt` application has a shared logger configuration that is used by all the applications, it sets the timestamp in ISO format and the level in uppercase. Setting it in the `watt` application ensures that the logs will be consistent across all the applications.

`watt.config.ts`

```ts config
import { defineConfig } from 'wattpm'

export default defineConfig({
  logger: {
    level: 'info',
    timestamp: 'isoTime'
  },
  autoload: {
    path: 'applications'
  }
})
```

The applications have their own configuration. The `gateway` application is the intended public ingress, while `backend` has a redaction configuration:

`gateway/watt.config.ts`

```ts config
import { gateway } from '@platformatic/gateway'

export default gateway({
  server: {
    hostname: process.env.HOSTNAME ?? '127.0.0.1',
    port: Number(process.env.PORT ?? 3042)
  }
})
```

`backend/watt.config.ts`

```ts config
import { node } from '@platformatic/node'

export default node({
  logger: {
    level: 'debug',
    redact: {
      paths: ['req.headers.authorization'],
      censor: '***HIDDEN***'
    }
  },
  server: { port: Number(process.env.PORT ?? 3043) }
})
```

In the `node` application the logger is available via [`getLogger()`](../reference/runtime/globals.md#logging-and-observability), for example

`backend/src/app.js`

```js
import { getLogger } from '@platformatic/globals'
import fastify from 'fastify'

const app = fastify({
  loggerInstance: getLogger()
})
```

The `next` application has a custom formatter that adds the `application` property to the logs, note the application level is different in the applications.

`next/watt.config.ts`

```ts config
import { next } from '@platformatic/next'

export default next({
  application: {
    basePath: '/next'
  },
  logger: {
    level: 'debug'
  },
  server: { port: Number(process.env.PORT ?? 3044) }
})
```

Then in the `next` application the logger is available via [`getLogger()`](../reference/runtime/globals.md#logging-and-observability), for example

`next/src/app/page.jsx`

```jsx
import { getLogger } from '@platformatic/globals'

export default function Home () {
  const logger = getLogger()
  logger.debug('Home page called')

  return (
    <main>
      <div>Hello World!</div>
    </main>
  )
}
```
