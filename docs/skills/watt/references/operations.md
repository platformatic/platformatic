---
title: Operate and Deploy Watt
---

# Operate and deploy Watt

## Runtime commands

Use `wattpm help` and `wattpm help <command>` for the installed version's exact syntax.
Use `wattpm dev` for development and `wattpm build` followed by `wattpm start` for
production. Do not recommend removed `create`, `init`, `add`, or `import` commands.

| Need | Command |
| --- | --- |
| List running runtimes | `wattpm ps` |
| List applications | `wattpm applications [runtime]` |
| Read logs | `wattpm logs [runtime] [application]` |
| Test HTTP endpoints | `wattpm inject --path /hello` |
| Inspect environment | `wattpm env [runtime] --table` |
| Capture CPU profiles | `wattpm pprof start [runtime] [application]`, then `stop` |
| Capture a heap snapshot | `wattpm heap-snapshot [runtime] [application]` |
| Start the admin UI | `wattpm admin` |
| Read this skill | `wattpm skill [FILE]` |

Use `wattpm-utils install`, `update`, `resolve`, and `migrate` for their operational
purposes only. Ask before dependency updates, remote downloads, or migration.
`applications:add` and `applications:remove` change a running runtime; they are not
project scaffolding. Inspect their help, especially before persisting changes with `--save`.

## Observability and scheduling

Inspect the runtime and capability schemas before adding logging, telemetry, metrics,
or scheduler settings. Put runtime-wide options on the runtime root. Use environment
variables for log level and OTLP endpoints; configure redaction for secrets. Do not
expose metrics/control endpoints publicly without protection.

Read the current logging, metrics, tracing, and scheduler documentation for option
shapes. For scheduled work, configure a named cron job and an internal application
callback URL such as `http://api.plt.local/jobs/daily`. Make handlers idempotent and
plan for retries; do not promise persisted scheduler state without support.

For profiling, select runtime/application IDs with `ps` and `applications`, prefer
production-like traffic, and stop profiling after collection. Use `@platformatic/flame`
to render captured pprof files if installed and authorized. Heap snapshots may contain
secrets and are expensive; request permission and keep them out of source control.

## Docker

Preserve an existing Dockerfile unless the user requests replacement. For a new
deployment, write a multi-stage build using a supported Node.js version, the project's
package manager and lockfile, and `wattpm build`. Include workspace manifests and all
required production assets and capability packages. Run `wattpm start` as a non-root
user; do not leave a development server or package installer in the startup command.

For npm, `npm ci` needs a committed lockfile. For pnpm, use its supported installation
method and frozen lockfile; do not assume Corepack is available. Native database
drivers must be built for the runtime image's architecture and libc. Avoid copying
host `node_modules` or secrets into images. Bind the public entrypoint to `0.0.0.0`
inside containers and configure its actual port. Add `.dockerignore`.

## Kubernetes and cloud

Write Deployment and Service manifests with the application's actual image, listener,
resource requirements, environment and secret references. Configure readiness/liveness
using documented endpoints, not invented `/health` routes. Keep control and metrics
ports private. Leave room for worker memory and gracefully handle termination.

For Fly.io, Railway, Render, ECS, or another platform, inspect existing files and the
platform's current deployment requirements. Preserve build/start commands and choose
an appropriate public port and health check. Do not deploy or provision resources
without authorization. Explain required secrets and external database/network setup.

## Verification

Check development startup, production build/start, public routing, internal calls,
shutdown, and deployment health checks. Report unsupported external capabilities or
unverified infrastructure explicitly rather than silently substituting another framework.
