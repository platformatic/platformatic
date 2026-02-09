# Advanced OpenTelemetry Setup with Watt

import Issues from '../getting-started/issues.md';

## Introduction

Watt includes [built-in telemetry support](./distributed-tracing.md) that can be configured declaratively in your `watt.json` or `platformatic.json` files. This works well for most use cases with OTLP and Zipkin exporters.

However, you may need manual OpenTelemetry SDK setup when you:

- Need custom instrumentations beyond what the built-in telemetry provides
- Want to configure custom span processors or exporters
- Need fine-grained control over OpenTelemetry SDK initialization

This guide covers how to set up the OpenTelemetry Node.js SDK manually in Watt.

## Understanding Multi-Worker Architecture

Watt runs each application in isolated [Node.js Worker Threads](../reference/runtime/multithread-architecture.md). This has important implications for OpenTelemetry setup:

- **Each worker is isolated**: Every worker thread runs its own OpenTelemetry SDK instance
- **Initialization must happen early**: OpenTelemetry must load before any instrumented modules
- **Context propagation is automatic**: Watt handles trace context propagation between workers via HTTP headers

The `execArgv` configuration with `--import` ensures your initialization script runs in each worker thread before application code loads.

## Configuration Options

Watt provides the `execArgv` configuration on each application to pass Node.js flags to worker threads. This is required for OpenTelemetry because the instrumentation hooks must be registered via `--import` before any application code loads.

### Application-Level Configuration

Use the `execArgv` option on each application to configure OpenTelemetry:

```json
{
  "$schema": "https://schemas.platformatic.dev/wattpm/3.0.0.json",
  "applications": [
    {
      "id": "api",
      "path": "./services/api",
      "execArgv": [
        "--import", "@opentelemetry/instrumentation/hook.mjs",
        "--import", "./telemetry-init.mjs"
      ]
    }
  ],
  "server": {
    "port": 3000
  }
}
```

### Multiple Applications

When you have multiple applications, each needs its own `execArgv` configuration:

```json
{
  "$schema": "https://schemas.platformatic.dev/wattpm/3.0.0.json",
  "applications": [
    {
      "id": "api",
      "path": "./services/api",
      "execArgv": [
        "--import", "@opentelemetry/instrumentation/hook.mjs",
        "--import", "./telemetry-init.mjs"
      ]
    },
    {
      "id": "worker",
      "path": "./services/worker",
      "execArgv": [
        "--import", "@opentelemetry/instrumentation/hook.mjs",
        "--import", "./telemetry-init.mjs"
      ]
    }
  ]
}
```

## Initialization Script

The initialization script configures the OpenTelemetry SDK and must be loaded before any application code. Here's a complete example:

```javascript
// telemetry-init.mjs
import { workerData } from 'node:worker_threads'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

// Get service name from workerData (set by Platformatic)
const serviceName = workerData?.applicationConfig?.id || 'unknown-service'

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '1.0.0'
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : {}
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable specific instrumentations if needed
      '@opentelemetry/instrumentation-fs': { enabled: false }
    })
  ]
})

sdk.start()

// Graceful shutdown to flush pending spans
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Telemetry terminated'))
    .catch((error) => console.log('Error terminating telemetry', error))
    .finally(() => process.exit(0))
})
```

The `workerData` object is automatically set by Watt for each worker thread and contains the application configuration. The `applicationConfig.id` property holds the service identifier as defined in your `watt.json`.

### Why the Hook is Required

The module loading order is critical:

1. Node.js processes `--import` flags in order before the application starts
2. The OpenTelemetry hook registers loader hooks to intercept module imports
3. Your initialization script configures and starts the SDK
4. Application code loads (instrumentation is applied via the hook)

Without the hook, OpenTelemetry cannot intercept imports and instrumentation will not work.

### Disabling Built-in Telemetry

When using manual SDK setup, you should disable Watt's built-in telemetry to avoid conflicts (duplicate spans, multiple exporters, etc.):

```json
{
  "applications": [
    {
      "id": "api",
      "path": "./services/api",
      "execArgv": [
        "--import", "@opentelemetry/instrumentation/hook.mjs",
        "--import", "./telemetry-init.mjs"
      ],
      "telemetry": {
        "enabled": false
      }
    }
  ]
}
```

## Troubleshooting

### Telemetry Not Appearing

1. **Check module loading order**: Ensure OpenTelemetry loads before application code
2. **Verify exporter URL**: Confirm the collector endpoint is accessible
3. **Check for errors**: Look for initialization errors in logs
4. **Validate configuration**: Ensure environment variables are set correctly

### Module Loading Errors

Common issues:

- **"Cannot use import statement outside a module"**: Ensure your initialization file has `.mjs` extension
- **Module not found**: Check the import path is correct and the package is installed

### OpenTelemetry SDK Not Initializing

1. Verify all required environment variables are set
2. Ensure the module path in `execArgv` is correct and the module exists
3. Check for initialization errors in the console output
4. Verify the OTLP endpoint is accessible from the application

## Complete Example with Jaeger

**watt.json:**
```json
{
  "$schema": "https://schemas.platformatic.dev/wattpm/3.0.0.json",
  "entrypoint": "api",
  "applications": [
    {
      "id": "api",
      "path": "./services/api",
      "execArgv": [
        "--import", "@opentelemetry/instrumentation/hook.mjs",
        "--import", "./telemetry.mjs"
      ]
    }
  ],
  "env": {
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4318/v1/traces"
  },
  "server": {
    "port": 3000
  }
}
```

**telemetry.mjs:**
```javascript
import { workerData } from 'node:worker_threads'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

// Get service name from workerData (set by Platformatic)
const serviceName = workerData?.applicationConfig?.id || 'unknown-service'

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: serviceName
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  }),
  instrumentations: [getNodeAutoInstrumentations()]
})

sdk.start()

process.on('SIGTERM', () => sdk.shutdown())
```

**Start Jaeger:**
```bash
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \
  -p 4317:4317 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

<Issues />
