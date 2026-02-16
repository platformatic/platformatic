# OpenTelemetry Logging with Watt

## Introduction

Watt supports exporting logs directly to OpenTelemetry-compatible collectors, providing enterprise-grade observability alongside distributed tracing. This feature enables:

- **Unified Observability**: Correlate logs with traces using trace context
- **Centralized Log Management**: Export logs to any OTLP-compatible backend (Grafana, Datadog, New Relic, etc.)
- **Automatic Trace Correlation**: Logs automatically include trace ID, span ID, and trace flags
- **Resource Attributes**: Automatic service identification with name and version

## Quick Start

### Basic Configuration

Add OpenTelemetry log export to your `watt.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/wattpm/3.0.0.json",
  "logger": {
    "level": "info",
    "telemetryExporter": {
      "protocol": "http",
      "url": "http://localhost:4318/v1/logs"
    }
  },
  "telemetry": {
    "enabled": true,
    "applicationName": "my-service",
    "version": "1.0.0"
  }
}
```

This configuration:

- Exports logs to an OTLP collector at `localhost:4318`
- Uses HTTP protocol (also supports gRPC)
- Identifies the service as "my-service" v1.0.0
- Automatically correlates logs with traces

### Protocol Options

The `telemetryExporter` supports two protocols:

#### HTTP Protocol (Recommended)

```json
{
  "logger": {
    "telemetryExporter": {
      "protocol": "http",
      "url": "http://collector:4318/v1/logs"
    }
  }
}
```

#### gRPC Protocol

```json
{
  "logger": {
    "telemetryExporter": {
      "protocol": "grpc",
      "url": "http://collector:4317"
    }
  }
}
```

## How It Works

### Architecture

When OpenTelemetry logging is configured, Watt:

1. **Creates Multi-Stream Logger**: Adds an OpenTelemetry transport alongside existing outputs (CLI, management API)
2. **Injects Trace Context**: Automatically adds trace ID, span ID, and flags to every log entry
3. **Exports to Collector**: Sends logs to the configured OTLP endpoint
4. **Maintains Correlation**: Each worker thread includes trace context from active spans

```
Application Logger
  ├─ CLI Output (pino-pretty)
  ├─ Management API Stream
  └─ OpenTelemetry Transport → OTLP Collector
      └─ Includes: trace_id, span_id, trace_flags
```

### Trace Context Injection

Every log entry of `globalThis.platformatic.logger` automatically includes trace context when a span is active:

```json
{
  "level": 30,
  "time": 1234567890,
  "msg": "Processing request",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "trace_flags": "01"
}
```

This enables powerful correlation in observability platforms:

- Filter logs by trace ID to see all logs for a request
- Jump from traces to related logs
- Analyze log patterns within trace context

## Configuration Reference

### Logger Configuration

The `logger.telemetryExporter` object configures OpenTelemetry export:

| Property   | Type               | Required | Description             |
| ---------- | ------------------ | -------- | ----------------------- |
| `protocol` | `"http" \| "grpc"` | Yes      | Transport protocol      |
| `url`      | `string`           | Yes      | OTLP collector endpoint |

### Telemetry Configuration

The `telemetry` object provides service identity:

| Property          | Type      | Required | Description                              |
| ----------------- | --------- | -------- | ---------------------------------------- |
| `enabled`         | `boolean` | No       | Enable/disable telemetry (default: true) |
| `applicationName` | `string`  | Yes      | Service name in telemetry                |
| `version`         | `string`  | No       | Service version                          |

## Integration Examples

### With Grafana Stack (Loki + Tempo)

```json
{
  "logger": {
    "level": "info",
    "telemetryExporter": {
      "protocol": "http",
      "url": "http://otel-collector:4318/v1/logs"
    }
  },
  "telemetry": {
    "enabled": true,
    "applicationName": "api-gateway",
    "version": "2.0.0",
    "exporter": {
      "type": "otlp",
      "options": {
        "url": "http://otel-collector:4318/v1/traces"
      }
    }
  }
}
```

The OTLP collector configuration:

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
      grpc:
        endpoint: 0.0.0.0:4317

exporters:
  loki:
    endpoint: http://loki:3100/loki/api/v1/push
  tempo:
    endpoint: tempo:4317
    tls:
      insecure: true

processors:
  batch:
  resource:
    attributes:
      - action: insert
        key: loki.resource.labels
        value: service.name, service.version

service:
  pipelines:
    logs:
      receivers: [otlp]
      processors: [batch, resource]
      exporters: [loki]
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [tempo]
```

### With Jaeger (Traces + Logs)

```json
{
  "logger": {
    "telemetryExporter": {
      "protocol": "http",
      "url": "http://jaeger:4318/v1/logs"
    }
  },
  "telemetry": {
    "enabled": true,
    "applicationName": "my-service",
    "exporter": {
      "type": "otlp",
      "options": {
        "url": "http://jaeger:4318/v1/traces"
      }
    }
  }
}
```

## Multi-Application Setup

When using multiple applications in a Watt runtime, each inherits the logger configuration:

```json
{
  "$schema": "https://schemas.platformatic.dev/wattpm/3.0.0.json",
  "entrypoint": "gateway",
  "autoload": {
    "path": "services"
  },
  "logger": {
    "level": "info",
    "telemetryExporter": {
      "protocol": "http",
      "url": "{OTLP_ENDPOINT}/v1/logs"
    }
  },
  "telemetry": {
    "enabled": true,
    "applicationName": "microservices-platform",
    "version": "1.0.0"
  }
}
```

Each service automatically:

- Exports logs to the same OTLP endpoint
- Includes its service name in logs
- Maintains trace context across service boundaries

## Combined with Existing Transports

OpenTelemetry export works alongside existing logger transports:

```json
{
  "logger": {
    "level": "debug",
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
            "destination": "/var/log/errors.log"
          }
        }
      ]
    },
    "telemetryExporter": {
      "protocol": "http",
      "url": "http://collector:4318/v1/logs"
    }
  }
}
```

This configuration:

- Displays pretty logs in console (info and above)
- Writes errors to file
- Exports all logs to OpenTelemetry collector
