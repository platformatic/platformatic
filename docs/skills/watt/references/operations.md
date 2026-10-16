# Operate and deploy Watt 4

Use release-matched `wattpm help` for exact syntax; do not execute commands without
authorization. Build before production startup. See the detailed [CLI](wattpm-cli.md).

| Need | Command |
| --- | --- |
| Development / production | `wattpm dev`, `wattpm build`, `wattpm start` |
| Runtimes / applications | `wattpm ps`, `wattpm applications [runtime]` |
| Logs | `wattpm logs [runtime] [application]` |
| Endpoint testing | `wattpm inject [runtime] [application] --path /hello` |
| Environment | `wattpm env [runtime] [application] --table` (do not disclose secrets) |
| CPU profile | `wattpm pprof start [runtime] [application]`, then `stop` |
| Heap snapshot | `wattpm heap-snapshot [runtime] [application]` |
| Admin UI / skill | `wattpm admin`, `wattpm skill [FILE]` |

For multi-application injection, select an application explicitly. Use `wattpm-utils`
for `install`, `update`, `resolve`, and `migrate`. Runtime `applications:add`/`remove`
are operational changes, not project generators; inspect help before `--save`.

## Observability, scheduling, profiling

Read [observability](observability.md) before configuring logging, tracing, or metrics.
Use runtime-wide options on the root, application options on their capability. Redact
secrets and protect metrics/control endpoints. Inspect installed schemas for exact shapes.

Read [scheduler](scheduler.md) for cron callbacks, retry semantics, application tasks,
and external coordination. Keep handlers idempotent; do not promise persisted state.

Read [performance](performance.md) for pprof, flamegraphs, heap snapshots, workers, and
caching. Select IDs with `ps`/`applications`, use production-like traffic, stop profiling
after collection, and keep artifacts private. Heap snapshots may expose secrets and
pause expensive workloads; request permission. Install/render with `@platformatic/flame`
only when authorized.

## Deployment

- [Docker](deployment/docker.md): preserve existing Dockerfiles; use compatible Node,
  lockfile/package manager, workspace manifests, production capability dependencies,
  build assets, and non-root `wattpm start`. Never copy host dependencies or secrets.
- [Kubernetes](deployment/kubernetes.md): use actual listener/image/resources and
  documented health endpoints. Keep metrics/control private, allow worker memory and
  writable caches, and handle termination gracefully.
- [Cloud](deployment/cloud.md): retain provider configs and build/start conventions,
  choose actual ports/health routes, and check current provider requirements. Framework-only
  hosting is not automatically a Watt runtime deployment.

For npm, `npm ci` requires a lockfile. For pnpm, use a supported installer and frozen
lockfile; do not assume Corepack. Build native drivers for runtime architecture/libc.
Bind public container listeners to `0.0.0.0`. Do not provision or deploy without permission.

## Completion

With permission, check dev startup, build/start, public routing, internal calls,
shutdown, and deployment health. Report unverified infrastructure and unsupported
capabilities rather than silently substituting a framework.
