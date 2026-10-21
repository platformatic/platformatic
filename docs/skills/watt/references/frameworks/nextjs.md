# Next.js on Watt 3

Detect `next.config.*` and the `next` dependency. Use `@platformatic/next`, not generic
Vite. Install matching major 3 Watt packages with authorization and preserve the Next.js
version and configuration unless the task calls for a framework upgrade.

## Configuration

```json
{
  "module": "@platformatic/next",
  "runtime": {
    "server": { "hostname": "0.0.0.0", "port": "{PORT}" },
    "workers": 2
  }
}
```

Prefer capability lifecycle defaults. Add `application.commands` only for a specific
custom build/start contract; custom commands can change listener and output behavior.
In a multi-app root, put worker counts on the application's orchestration entry.

Keep Next.js `basePath`, the gateway prefix, and `application.basePath` consistent.
Test HTML, assets, redirects, API routes, image optimization, and server-side mesh calls.
Do not promise automatic fallback to another port when the configured port is occupied.

## Build and deployment

- Run `wattpm build` before production startup. Next.js owns its TypeScript and JSX build;
  Node.js type stripping is not a replacement.
- Preserve the configured bundler and inspect compatibility with installed Next/Watt
  versions rather than universally disabling Turbopack.
- When using Next.js `output: 'standalone'`, also inspect the capability's
  `next.standalone` option and the app-specific pack command shown by `wattpm help`.
- Deploy server output, static assets, and required dependencies together. A static
  export needs a static hosting strategy rather than a server-rendering assumption.
- `NEXT_PUBLIC_*` values can be baked into the client at build time. Keep private secrets
  server-side and distinguish build-time configuration from runtime configuration.

## Workers and cache

Budget CPU and memory empirically rather than applying a fixed workers-to-CPU rule.
For shared ISR caching, the capability supports:

```json
{
  "cache": {
    "adapter": "valkey",
    "url": "{CACHE_URL}"
  }
}
```

Inspect the installed Next.js version before using Cache Components or selecting a
`revalidateTag` signature. Configure shared storage and verify invalidation across both
workers and replicas; do not assume an in-memory cache is globally coherent.

Protect CMS webhook/revalidation endpoints and check upstream responses before reporting
successful invalidation. See [CMS integration](../cms-integration.md).

## Multi-zone applications

Use explicit application IDs and a gateway with distinct prefixes. Preserve Next.js
asset prefixes, routing, and deployment identity. Exercise cross-zone navigation and
redirects through the public gateway rather than checking only direct worker requests.

See [performance](../performance.md), [enterprise](../enterprise.md), and
[Docker](../deployment/docker.md).
