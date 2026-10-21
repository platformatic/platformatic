# Scaffold a Watt 3 application

Inspect the target directory first and agree on framework, package manager, application
IDs, listeners, database needs, and module system. Generate complete files rather than
overwriting existing application structure. Keep Watt packages on major 3.

## Minimal service

With authorization, install `wattpm@^3.74.0` and `@platformatic/service@^3.74.0` using
the project's package manager. Preserve an existing lockfile and dependency policy.

`watt.json`:

```json
{
  "module": "@platformatic/service",
  "server": { "hostname": "0.0.0.0", "port": "{PORT}" },
  "plugins": { "paths": ["./app.js"] },
  "service": { "openapi": true }
}
```

`app.js`, in a package with `"type": "module"`:

```js
export default async function app (server) {
  server.get('/hello', async () => ({ hello: 'world' }))
}
```

Merge these scripts into `package.json`:

```json
{
  "scripts": {
    "dev": "wattpm dev",
    "build": "wattpm build",
    "start": "wattpm start"
  }
}
```

Document `PORT=3042` in `.env.example`. Preserve secrets and existing environment files.
Provide a README covering installation, environment, startup, build, and checks.

For multiple applications, use the root and gateway patterns in [enterprise](enterprise.md).
For a framework project, follow its [capability guide](frameworks.md) and keep original
framework build scripts under clear names if the top-level scripts become Watt commands.

## Existing generators

Watt 3 retains `wattpm create`, `init`, and `add`, as well as the create packages and
import commands. They remain supported alternatives; do not describe them as removed.
Prefer direct file editing for agent-driven changes. When a generator is requested,
inspect `wattpm help create`, preserve local work, and avoid `--latest` or unversioned
downloads that could select a different major.

With authorization, validate development startup, endpoints, production build/start,
and shutdown. Report exactly which checks ran.
