# Observability in Watt 4

Keep runtime-wide options on the runtime root and capability-specific settings on the
application. Inspect installed schemas and backend requirements. Do not dump configuration
or environment values containing secrets, and protect metrics/control/collector ports.

## Pino logging

Watt uses Pino structured logging. Merge these options into the existing ESM root config,
preserving its topology:

```js
import { createWattConfig } from 'wattpm'

export default createWattConfig({
  applications: [{ id: 'api', path: './applications/api' }],
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: 'isoTime',
    base: { service: 'my-app', version: '1.0.0' },
    redact: {
      paths: [
        'req.headers.authorization', 'req.headers.cookie',
        'password', 'apiKey', 'token', '*.password', '*.secret'
      ],
      censor: '[REDACTED]'
    }
  }
})
```

Levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`. Preserve custom
levels (for example `{ verbose: 15, notice: 35 }`) when supported by the installed logger.

### Custom formatters

The installed logger schema supports `formatters: { path: './formatters.js' }`. An ESM
formatter module can export:

```js
export default {
  level (label) {
    return { level: label.toUpperCase() }
  },
  bindings (bindings) {
    return { pid: bindings.pid, host: bindings.hostname, service: bindings.service }
  }
}
```

Merge the formatter path into the logger configuration and ship the module with the
image. Verify the runtime's supported formatter hooks rather than assuming every generic
Pino option is forwarded. Multi-transport logging can impose restrictions on level formatting.

### Transports

Configure transports only after checking installed packages and runtime compatibility:

```js
const logger = {
  transport: {
    targets: [
      { target: 'pino-pretty', level: 'info', options: { colorize: true } },
      {
        target: 'pino/file',
        level: 'warn',
        options: { destination: `${process.env.LOG_DIR || './logs'}/error.log`, mkdir: true }
      },
      {
        target: 'pino-opentelemetry-transport',
        level: 'info',
        options: { loggerName: 'my-app', serviceVersion: '1.0.0' }
      },
      {
        target: 'pino-loki',
        level: 'info',
        options: { host: process.env.LOKI_URL, labels: { app: 'my-app' } }
      }
    ]
  }
}
```

This is an option fragment: select only wanted transports and pass it to the config.
Require configured backend URLs. `pino-pretty` is primarily for development; file
transports need writable storage/rotation. Container production often uses stdout.
Install transports only with permission; keep generated logs out of version control.

### Application logger

Use typed globals, not removed `globalThis.platformatic`:

```js
import { getLogger } from '@platformatic/globals'

const logger = getLogger()
logger.info('Application started')
const child = logger.child({ service: 'payment-api' })
child.info('Processing payment')
```

Choose a fallback logger explicitly for code that must run outside Watt. Initialize
resources before registering callbacks that can access them.

## OpenTelemetry tracing

Watt 4 renames config `telemetry` to **`tracing`** and package to `@platformatic/tracing`.
An exported symbol may still be named `telemetry`; inspect package exports before renaming imports.
An OTLP option fragment, to merge into the correct root/capability configuration:

```js
const tracing = {
  applicationName: 'my-service',
  version: '1.0.0',
  exporter: {
    type: 'otlp',
    options: {
      url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://127.0.0.1:4318'}/v1/traces`
    }
  }
}
```

Avoid duplicating `/v1/traces` if the supplied env variable is already a full trace URL.
The examined tracing schema requires `applicationName`, not the old example's `serviceName`.
OTLP HTTP commonly uses 4318; gRPC uses 4317 and requires the matching exporter contract.
Do not assume an HTTP exporter accepts a gRPC endpoint. Inspect supported exporter types;
legacy Jaeger Thrift/Zipkin examples are not proof of support in the installed release.

Environment conventions to preserve where applicable: `OTEL_SERVICE_NAME`,
`OTEL_SERVICE_VERSION`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`,
and `OTEL_RESOURCE_ATTRIBUTES`. Explicit config/env precedence depends on the integration.
Keep auth headers out of source and command history.

### OpenTelemetry logs and correlation

`pino-opentelemetry-transport` can use `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` and resource
attributes. Verify transport options/version and ensure a collector logs pipeline exists.

`@opentelemetry/instrumentation-pino` can correlate logs with active traces:

```js
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'

const instrumentation = new PinoInstrumentation({
  logKeys: { traceId: 'trace_id', spanId: 'span_id', traceFlags: 'trace_flags' }
})
```

Construction alone does not register instrumentation. Integrate it through the installed
tracing SDK's supported registration path, before Pino loads, and verify logs inside a span.
Avoid duplicate SDKs/instrumentation when Watt already owns tracing.

## Metrics

Metrics are not automatically enabled on port 9090. Configure them deliberately:

```js
const metrics = {
  port: Number(process.env.METRICS_PORT || 9090),
  hostname: '127.0.0.1'
}
```

Merge into the existing root. In a private container network, `0.0.0.0` may be needed
for scraping; do not publish it publicly. The examined schema accepts `auth` as a
username/password object, **not `auth: false`**. Use secret references when enabling it.
Verify actual metric names/labels in the selected runtime and capability: generic
`http_requests_total`, cache-hit, and worker-utilization names are not guaranteed.

### Custom application metrics

Use the registry/client integrated by the application or installed Watt metrics API;
do not assume an unrelated `prom-client` default registry is automatically aggregated.
A metric fragment using the chosen client:

```js
const requestCounter = new client.Counter({
  name: 'api_requests_total',
  help: 'Total API requests.',
  labelNames: ['method', 'route', 'status']
})
const duration = new client.Histogram({
  name: 'api_response_time_seconds',
  help: 'API response time in seconds.',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5]
})
const connections = new client.Gauge({
  name: 'active_connections',
  help: 'Current active connections.'
})
```

Use bounded route labels, not user IDs/raw URLs. Avoid duplicate metric registration
on reload. Verify both application and aggregated scrape output.

### Kubernetes scraping

Expose a private, named `metrics` Service port selecting the correct pod labels, then
use a ServiceMonitor whose selector matches that **Service**, not a mismatched example:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: watt-app
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: watt-app
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
```

The Prometheus operator/CRD must exist. Set authentication/TLS and network policy as
required. Confirm the actual endpoint and namespace selectors. Health probes may use
a separately configured runtime health server; do not expose it through the public app.

## Backend-specific integration

| Backend | Guidance |
| --- | --- |
| Jaeger | Use a supported Jaeger deployment with OTLP HTTP/gRPC receiver; point traces at that collector, not an obsolete Thrift exporter. Keep UI/collector ports private. |
| Datadog | Enable Agent `otlp_config.receiver.protocols.http`/`grpc` on private addresses. Preserve `DD_SERVICE`, `DD_ENV`, `DD_VERSION` mapping and verify resource attributes. |
| New Relic | Use the supported OTLP ingest endpoint with env-provided API-key headers; verify protocol, region, and `/v1/traces` path. |
| Grafana Tempo/Loki/Prometheus | Tempo receives traces; Loki receives logs via a configured Pino transport/collector; Prometheus scrapes the private runtime metrics endpoint. Grafana is visualization, not an exporter. |
| AWS CloudWatch/X-Ray | Use an ADOT collector with OTLP receivers and the appropriate exporters/IAM credentials. Point Watt to the collector, not an assumed direct ingest URL. |
| GCP Cloud Trace | Use a supported collector exporter and service-account/workload identity. Cloud Trace API URLs are not automatically OTLP ingest endpoints. |
| Azure Monitor | Use supported collector/exporter integration and `APPLICATIONINSIGHTS_CONNECTION_STRING`; merely installing an exporter does not register it. |

### ADOT collector fragment

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
      grpc:
        endpoint: 0.0.0.0:4317
exporters:
  awsxray:
    region: us-east-1
service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [awsxray]
```

Validate against the installed collector distribution; exporter availability and IAM
requirements vary. Do not provision cloud resources without permission.

### Local observability stack

Keep Compose services for app, collector/Jaeger, Prometheus, and Grafana on a private
network, with explicitly chosen supported image tags. Mount actual collector/Prometheus
configs. Avoid conflicting app/Grafana ports and do not default Grafana to anonymous Admin.
For local-only UIs, bind published ports to `127.0.0.1`.

`prometheus.yml` fragment, when the app exposes a private 9090 listener:

```yaml
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: watt-app
    static_configs:
      - targets: ['app:9090']
```

Verify traces, correlated logs, metric labels, secret redaction, and protected endpoints
with permission; installing packages alone is not observability validation.

## Resources

- [Platformatic logging](https://docs.platformatic.dev/docs/guides/logging)
- [Runtime configuration](https://docs.platformatic.dev/docs/reference/runtime/configuration)
- [Pino](https://getpino.io/)
- [OpenTelemetry JS](https://opentelemetry.io/docs/languages/js/)
- [Pino OTLP transport](https://github.com/pinojs/pino-opentelemetry-transport)
