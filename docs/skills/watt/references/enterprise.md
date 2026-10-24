# Enterprise patterns for Watt 4

Watt orchestrates applications; `@platformatic/gateway` exposes routes and composes
APIs. Preserve existing directory names such as `web/` when integrating, but use
`applications/` for new examples. Composer is legacy terminology, not the Watt 4 package
to scaffold. Install compatible capability dependencies in their owning workspace packages.

## Multi-application architecture

```text
Public listener → Gateway → Frontend / API / DB / Content worker
```

Example layout:

```text
enterprise-app/
├── watt.config.js
├── package.json
├── .env.example
└── applications/
    ├── gateway/       # Public listener and routing.
    ├── frontend/      # Framework build/configuration.
    ├── api/           # Fastify or Platformatic Service.
    ├── db/            # Platformatic DB and migrations.
    └── content-worker/
```

Each application has its own manifest, configuration, and code. Declare workspaces
using the existing manager. Root `watt.config.js`, in an ESM package:

```js
import { createWattConfig } from 'wattpm'

export default createWattConfig({
  logger: { level: process.env.LOG_LEVEL || 'info' },
  applications: [
    { id: 'gateway', path: './applications/gateway' },
    {
      id: 'frontend',
      path: './applications/frontend',
      workers: Number(process.env.PLT_FRONTEND_WORKERS || 1)
    },
    { id: 'api', path: './applications/api', workers: 2 },
    { id: 'db', path: './applications/db' },
    { id: 'content-worker', path: './applications/content-worker' }
  ]
})
```

Alternatively `autoload: { path: './applications' }` discovers applications. Use the
installed autoload override contract for per-application options; do not create an
obsolete root worker map. Explicit IDs may differ from directory names; Gateway and
mesh calls must match the configured ID. Keep worker counts on orchestration entries.

## Gateway routing

`applications/gateway/watt.config.js`:

```js
import { createGatewayConfig } from '@platformatic/gateway'

export default createGatewayConfig({
  server: {
    hostname: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3042)
  },
  gateway: {
    applications: [
      { id: 'frontend', proxy: { prefix: '/' } },
      { id: 'api', proxy: { prefix: '/api', rewritePrefix: '/' } },
      { id: 'content-worker', proxy: { prefix: '/content', rewritePrefix: '/' } }
    ]
  }
})
```

Within Watt, Gateway can use the application ID without an `origin`. For remote
services, inspect `origin`/`proxy.upstream` and the installed Gateway schema. Do not
carry Composer `internal://` examples forward as a requirement. Verify prefix
rewriting and the target application's own base path, redirects, assets, and WebSockets.
Do not assume array order is a universal route-priority rule. Test overlapping prefixes
and use supported method/route constraints where needed.

Typical public routes: `/` frontend, `/api/*` business API, `/content/*` CMS webhook.
Expose DB REST/GraphQL or composed OpenAPI only when explicitly intended and protected.
Avoid publishing admin secrets, diagnostic endpoints, or an unrestricted DB API.

## Internal communication

Server-side application code uses configured IDs:

```js
const response = await fetch('http://db.plt.local/users')
const products = await fetch('http://api.plt.local/products')
```

These addresses belong to Watt's internal mesh, not browser DNS. Keep internal
applications off fixed public ports when the capability supports it. Some framework
capabilities need a listener even for internal requests; consult the installed contract.
A public listener belongs to its application, never root `server`/`entrypoint`.
Multiple fixed-port workers need supported port sharing or explicit port assignment;
inspect OS behavior and capability `server.portAssignment`.

## Database application

Use [services and databases](services.md) for DB config, REST/GraphQL, types, migrations,
and authorization. Preserve the user's DB engine/schema and admin-secret semantics.
Do not enable production automatic migrations implicitly. Each database application
should have its own connection env name where needed.

## Multiple repositories

Keep source boundaries and existing local sibling development paths. For production,
declare compatible remote applications and resolve them inside the project:

```js
import { createWattConfig } from 'wattpm'

export default createWattConfig(({ command }) => ({
  applications: [
    { id: 'gateway', path: './applications/gateway' },
    command === 'dev'
      ? { id: 'users', path: '../users' }
      : {
          id: 'users',
          url: 'https://github.com/example/users.git',
          gitBranch: 'production',
          path: './external/users'
        }
  ]
}))
```

The sibling development path must already exist and be authorized; do not clone/move
source there automatically. Replace example URLs/revisions with user-provided ones.
Read [integration](integration.md) before proposing `wattpm-utils resolve --for start`.
It fetches and normally installs; use `--skip-dependencies` when install is not authorized.
Do not pass passwords in URLs/CLI arguments, rewrite `.env` to record resolved paths,
or evaluate every configuration context blindly.

Scripts use `wattpm dev`, `build`, `start`; a resolve script uses `wattpm-utils resolve`,
not `wattpm resolve`. Build all apps before production startup.

## Enterprise extensions

Existing Watt-Extra/ICC integrations may provide monitoring, policy, auth, audit, or
caching features, but their schema and Watt 4 compatibility are external contracts.
Do not emit unverified `extends`, `monitoring`, or `authentication` blocks. Inspect the
installed addon and its release documentation; report unsupported compatibility.
Preserve existing auth/audit behavior rather than substituting a generic template.

## Development infrastructure and deployment

Retain local Compose databases/caches, health checks, and persistent volumes. Credentials
in examples are local-only; production uses secret references. Keep public listener host
`0.0.0.0` inside containers, coordinate worker resources, and test graceful termination.
See [Docker](deployment/docker.md), [Kubernetes](deployment/kubernetes.md), and
[CMS](cms-integration.md) for detailed deployment/webhook patterns.

## Resources

- [Gateway configuration](https://docs.platformatic.dev/docs/reference/gateway/configuration)
- [Multi-repository guide](https://docs.platformatic.dev/docs/guides/use-watt-multiple-repository)
- [Platformatic DB](https://docs.platformatic.dev/docs/reference/db/configuration)
- [Composer demo](https://github.com/platformatic/composer-next-node-fastify) — legacy source; review versions before reuse.
