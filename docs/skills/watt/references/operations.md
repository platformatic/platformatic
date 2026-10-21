# Watt 3 operations

Use the installed local CLI and its `help` output. Runtime IDs and application IDs are
different: discover them with `wattpm ps` and `wattpm applications <runtime>`.

| Goal | Reference |
| --- | --- |
| Start, stop, restart, reload, inject, import/resolve | [CLI](wattpm-cli.md) |
| Logs, traces, metrics | [Observability](observability.md) |
| CPU/heap profiling and capacity | [Performance](performance.md) |
| Scheduled tasks | [Scheduler](scheduler.md) |
| Containers | [Docker](deployment/docker.md) |
| Probes, scaling, rolling deployments | [Kubernetes](deployment/kubernetes.md) |
| Managed deployment | [Cloud](deployment/cloud.md) |
| Failures | [Troubleshooting](troubleshooting.md) |

Build with the same lockfile and compatible Node.js version used for deployment.
Preserve framework artifacts and production dependencies. Supply environment variables
through the deployment platform; do not bake secrets into images or frontend bundles.

Measure actual health endpoints, startup time, termination behavior, worker memory,
database pool usage, and cache behavior before increasing replicas or workers.
Configuration and environment output can contain credentials; redact it in reports.

Stop processes started for diagnostics, keep profiles out of source control, and
distinguish static review from commands actually run.
