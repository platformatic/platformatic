# Watt 3 observability

Inspect the existing logging, tracing, and metrics setup before adding another agent or
exporter. Keep the installed schemas authoritative. Runtime options belong at the root
of a runtime configuration or under `runtime` in a standalone capability configuration.

## Logging

Watt uses Pino. Start with the existing logger and structured fields:

```json
{
  "logger": { "level": "{PLT_SERVER_LOGGER_LEVEL}" }
}
```

Keep structured output in production. Route stdout through the platform collector or
configure an installed Pino transport with its documented options. Do not add duplicate
logging pipelines merely to send logs to Elasticsearch, Loki, Datadog, or another backend.
Configure redaction for credentials and sensitive request fields before exporting logs.

Use `wattpm logs <runtime> [application]` to isolate an app. Correlate logs with application,
worker, request, and trace identifiers where the instrumentation provides them.

## Tracing

Watt 3 uses `telemetry`, not the Watt 4 `tracing` configuration key. A typical OTLP setup:

```json
{
  "telemetry": {
    "serviceName": "my-app",
    "exporter": {
      "type": "otlp",
      "options": { "url": "{OTEL_EXPORTER_OTLP_ENDPOINT}" }
    }
  }
}
```

Set the endpoint to the collector's trace endpoint appropriate to the selected exporter.
Check protocol, path, authentication, TLS, resource attributes, and sampling against
the installed telemetry schema and exporter. Do not assume OTLP/HTTP and gRPC endpoints
are interchangeable. Avoid registering a second OpenTelemetry SDK over an existing one.

For Jaeger, Tempo, Datadog, New Relic, AWS, GCP, or Azure, prefer the platform's collector
and its documented backend exporter. Verify a trace through the gateway and an internal
application call; a healthy collector alone does not demonstrate context propagation.

## Metrics

Runtime Prometheus exposure can use:

```json
{
  "metrics": { "port": 9090 }
}
```

Confirm the actual bind address and path from the installed schema. Keep the endpoint
internal and configure scrape discovery and labels for each replica. Inspect the emitted
metric names before writing dashboards or alerts rather than assuming generic names.

Monitor request errors/latency, worker health, event-loop delay, CPU throttling, heap/RSS,
database pool pressure, and exporter failures. Separate readiness from monitoring: a
metrics endpoint does not establish that every application is ready.

## Validate

With authorization, generate a representative request and confirm logs, trace spans,
and metric changes in the intended backend. Check startup and shutdown flushing,
collector failure behavior, sampling overhead, and secret redaction.

See [performance](performance.md), [operations](operations.md), and
[Kubernetes](deployment/kubernetes.md).
