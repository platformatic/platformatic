# Multi-application Watt 3 deployments

## Topology and ownership

Inventory applications, IDs, listeners, build commands, and database ownership before
reorganizing a monorepo. Use `@platformatic/gateway` for a new gateway. Older examples
using Composer, `internal://`, or v2 schema URLs are not templates for this release.

An explicit runtime root `watt.json`:

```json
{
  "module": "wattpm",
  "entrypoint": "gateway",
  "server": { "hostname": "0.0.0.0", "port": "{PORT}" },
  "applications": [
    { "id": "gateway", "path": "./web/gateway" },
    { "id": "frontend", "path": "./web/frontend", "workers": 2 },
    { "id": "api", "path": "./web/api" },
    { "id": "db", "path": "./web/db" }
  ]
}
```

Alternatively use `autoload: { "path": "web" }`, with `autoload.mappings` for per-app
options. Root runtime settings belong at the root; `runtime` wrapping belongs in a
standalone capability configuration. Root `workers` supplies a default count; per-app
counts belong on the application entries, not in a root map keyed by ID.

`web/gateway/watt.json`:

```json
{
  "module": "@platformatic/gateway",
  "gateway": {
    "applications": [
      { "id": "frontend", "proxy": { "prefix": "/" } },
      { "id": "api", "proxy": { "prefix": "/api" } }
    ]
  }
}
```

Keep the database private unless its APIs are intentionally public. Review prefix
rewriting, authentication, redirects, OpenAPI composition, and WebSocket routes.
Do not infer route priority from array ordering; verify representative routes.

## Internal communication

Server-side code can call `http://api.plt.local/path` using application IDs. These URLs
are internal to Watt, not browser-accessible hostnames. Gateway entries can omit
`origin` for applications in the same runtime. External services need actual HTTP origins.

Declare startup dependencies when one application needs another during initialization.
Keep handlers resilient to restart and unavailable dependencies; a shared process does
not make remote calls infallible.

## Multiple repositories

Application entries can carry `url`, `path`, and `gitBranch` for external repositories.
Use the existing v3 `wattpm import` / `wattpm resolve` workflow only when authorized.
Inspect local changes before cloning or updating a checkout, pin deployable revisions,
and preserve local sibling paths used for development.

Build and deploy a reproducible set of application revisions and a frozen lockfile.
Treat resolving repositories, installing dependencies, and starting the application as
separate operations with separately reported outcomes.

## Production review

- Budget memory and CPU across workers and replicas; benchmark before increasing counts.
- Avoid multiplying database connection pools beyond the database limit.
- Use shared storage when caches must be consistent across workers or replicas.
- Supply secrets through the deployment environment and keep public listeners explicit.
- Verify readiness, rolling replacement, shutdown, and routing under worker restarts.
- Check installed addons' documentation rather than inventing `extends` or enterprise options.

See [services](services.md), [observability](observability.md),
[performance](performance.md), and [Kubernetes](deployment/kubernetes.md).
