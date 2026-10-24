# Next.js with Watt 4

## Detection and installation

Detect `next.config.{js,ts,mjs}` and the `next` dependency. With authorization, install
compatible Watt 4 `wattpm` and `@platformatic/next` using the existing package manager.
Preserve App Router/Pages Router, React version, routes, middleware, image settings,
and existing adapter/build choices.

## Configuration

In an ESM project, `watt.config.js`:

```js
import { createNextConfig } from '@platformatic/next'

export default createNextConfig({
  server: {
    hostname: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3000)
  }
})
```

Use `.ts` in a TypeScript ESM project, or `.mjs`/`.mts` to force ESM without changing
the package type. The capability handles default lifecycle commands; preserve original
scripts when introducing `wattpm dev`, `build`, and `start`.

For a prefix, inspect `application.basePath`, Next.js `basePath`, and Gateway rewriting
together. Do not assume setting one changes all asset paths. Multi-zone roots declare
`applications` with unique IDs and paths, not `services`.

### Workers

Workers belong to the runtime application entry. A single app with runtime options:

```js
import { createWattConfig } from 'wattpm'
import { createNextConfig } from '@platformatic/next'

export default createWattConfig({
  logger: { level: process.env.LOG_LEVEL || 'info' },
  application: {
    workers: Number(process.env.PLT_NEXT_WORKERS || 1),
    config: createNextConfig({
      server: { port: Number(process.env.PORT || 3000) }
    })
  }
})
```

In a workspace use `{ id: 'storefront', path: './apps/storefront', workers: 4 }`.
Do not use a root map keyed by directory path. Size CPU/memory from measurements;
workers do not guarantee proportional throughput. See [performance](../performance.md).

### Output and deployment

Run `wattpm build` before `start`. Use `output: 'standalone'` only when that deployment
needs it, and set capability `next: { standalone: true }` for Watt's standalone path.
Include the Watt runtime and capability, not just Next's `server.js`; see
[Docker](../deployment/docker.md). Static `output: 'export'` is a different hosting path,
not this SSR integration. Check supported Next.js/Turbopack versions instead of universally
disabling Turbopack. Native config type stripping does not compile TSX or replace Next's build.

## Environment and images

Keep Next's `.env.local`, `.env.production`, and `NEXT_PUBLIC_*` conventions. `HOST`,
`PORT`, and `LOG_LEVEL` in these examples are explicitly read by config, not automatically
injected listener settings. Preserve existing variable names when integrating.

For external images, retain or extend `images.remotePatterns` in `next.config.*`:

```js
export default {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.ctfassets.net' },
      { protocol: 'https', hostname: 'cdn.example.com' }
    ]
  }
}
```

## ISR, cache tags, and CMS

For projects using `unstable_cache`, a tagged server-side fetch can be:

```ts
import { unstable_cache } from 'next/cache'

export const getProducts = unstable_cache(
  async () => {
    const response = await fetch('http://api.plt.local/products')
    return response.json()
  },
  ['products'],
  { tags: ['products'], revalidate: 3600 }
)
```

Use the installed Next.js cache API. Current versions accept `revalidateTag(tag, 'max')`
for stale-while-revalidate; choose the documented immediate-expiration API when required.
Do not silently change webhook freshness guarantees. Authenticate revalidation endpoints,
validate tags, and check response status; see [CMS](../cms-integration.md).

For shared ISR caching, the capability supports Valkey/Redis:

```js
import { createNextConfig } from '@platformatic/next'

export default createNextConfig({
  server: { port: Number(process.env.PORT || 3000) },
  cache: {
    adapter: 'valkey',
    url: process.env.PLT_VALKEY_HOST,
    prefix: 'storefront'
  }
})
```

Require the cache URL when this configuration is enabled; never log credentials.
Cache Components require compatible Next.js versions and their matching configuration.
Do not assume default in-memory cache invalidation reaches all workers or replicas.
Verify shared cache, tag propagation, namespace, and expiration with the selected adapter.

## Troubleshooting

- Port conflicts: inspect the configured listener and owner; Watt does not automatically
  rewrite ports. Choose another explicit port or an ephemeral one when appropriate.
- API/middleware/images: exercise real routes and assets through the public gateway.
- Cache invalidation: test multiple workers and replicas, not only a single request.
- Production assets: retain `.next`, public assets, manifests, and required dependencies
  for the chosen deployment; do not assume native TS stripping replaces the build.

See [Next configuration](https://docs.platformatic.dev/docs/reference/next/configuration)
for listener, adapter, caching, and standalone options.
