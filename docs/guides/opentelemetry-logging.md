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
    "openTelemetryExporter": {
      "protocol": "http",
      "url": "http://localhost:4318/v1/logs"
    }
  },
  "telemetry": {
    "enabled": true,
    "applicationName": "my-service",
    "version": "1.0.0",
    "exporter": {
      "type": "otlp",
      "options": {
        "url": "http://localhost:4318/v1/traces"
      }
    }
  }
}
```

This configuration:

- Exports logs to an OTLP collector at `localhost:4318`
- Uses HTTP protocol (also supports gRPC)
- Identifies the service as "my-service" v1.0.0
- Automatically correlates logs with traces

### Protocol Options

The `openTelemetryExporter` supports two protocols:

#### HTTP Protocol (Recommended)

```json
{
  "logger": {
    "openTelemetryExporter": {
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
    "openTelemetryExporter": {
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

The `logger.openTelemetryExporter` object configures OpenTelemetry export:

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

## Integration Example (Grafana + Loki + Tempo)

### Watt configuration file (`watt.json`)

```json
{
  "logger": {
    "level": "info",
    "openTelemetryExporter": {
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
        "protocol": "http",
        "url": "http://otel-collector:4318/v1/traces"
      }
    }
  }
}
```

### Docker compose file (`docker-compose.yml`)

```yaml
services:
  loki:
    image: grafana/loki:3.4.1
    command: -config.file=/etc/loki/local-config.yaml
    ports:
      - '3100:3100'
    volumes:
      - ./loki-config.yaml:/etc/loki/local-config.yaml:ro

  tempo:
    image: grafana/tempo:2.8.0
    command: ['-config.file=/etc/tempo.yaml']
    ports:
      - '3200:3200'
      - '4317:4317'
    volumes:
      - ./tempo-config.yaml:/etc/tempo.yaml:ro

  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.145.0
    command: ['--config=/etc/otelcol/config.yaml']
    ports:
      - '4318:4318'
    volumes:
      - ./otel-collector-config.yaml:/etc/otelcol/config.yaml:ro
    depends_on:
      - loki
      - tempo

  grafana:
    image: grafana/grafana:11.6.0
    ports:
      - '3000:3000'
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
    depends_on:
      - loki
      - tempo
```

### OTLP collector configuration (`otel-collector-config.yaml`)

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

exporters:
  otlp_http/loki:
    endpoint: http://loki:3100/otlp
  otlp_grpc/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true

processors:
  batch:

service:
  pipelines:
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp_http/loki]
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp_grpc/tempo]
```

### Loki configuration file (`loki-config.yaml`)

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

common:
  path_prefix: /tmp/loki
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

storage_config:
  filesystem:
    directory: /tmp/loki/chunks

limits_config:
  allow_structured_metadata: true
```

### Tempo configuration file (`tempo-config.yaml`)

```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317

ingester:
  max_block_duration: 5m

compactor:
  compaction:
    block_retention: 24h

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/traces
```

### Grafana datasources file (`grafana/provisioning/datasources/datasources.yaml`)

```yaml
apiVersion: 1

datasources:
  - name: Loki
    uid: loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: true

  - name: Tempo
    uid: tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    jsonData:
      nodeGraph:
        enabled: true
      tracesToLogsV2:
        datasourceUid: loki
        spanStartTimeShift: -5m
        spanEndTimeShift: 5m
        tags: ['service.name']
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
    "openTelemetryExporter": {
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
    "openTelemetryExporter": {
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
