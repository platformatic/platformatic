# Astro with Watt 4

Detect `astro.config.*` or `astro` before plain Vite. Use compatible `wattpm` and
`@platformatic/astro`; install framework adapters only with authorization.

ESM `watt.config.js`:

```js
import { createAstroConfig } from '@platformatic/astro'

export default createAstroConfig({
  server: {
    hostname: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3000)
  }
})
```

## Rendering and build output

Preserve the existing adapter. For Node SSR projects, inspect installed Astro and
`@astrojs/node` compatibility before selecting adapter mode:

```js
import { defineConfig } from 'astro/config'
import node from '@astrojs/node'

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' })
})
```

Older Astro versions used `output: 'hybrid'`; do not emit that removed option for
versions where mixed rendering uses `server` and page-level `prerender` instead.
Static export hosting is a separate path, not a guarantee of this SSR integration.

Build before `wattpm start`. Typical Node adapter output includes `dist/server/entry.mjs`
and `dist/client/`; deploy complete output. Verify the adapter contract with the selected
capability rather than adding an unconditional production command from another framework.

## Environment, integrations, and health

Keep `import.meta.env` conventions: `PUBLIC_*` values can reach clients; secrets must not.
Retain React/Vue/Svelte integrations and content collections. Native config TS stripping
does not replace Astro builds/type checking.

An application-owned `src/pages/health.json.ts` can expose:

```ts
import type { APIRoute } from 'astro'

export const GET: APIRoute = () => Response.json({ status: 'ok' })
```

Probe its actual route (`/health.json` unless routing changes it), not a guessed `/health`.
Use `export const prerender = false` when the route must execute dynamically and that
matches the installed Astro rendering mode.

## Common issues

- Missing adapter/server output: inspect Astro version, adapter mode, and build artifacts.
- Container listener: configure capability hostname `0.0.0.0` for public containers.
- Docker HMR: merge `vite.server.watch.usePolling: true` only when filesystem watching needs it.
- Prefix/assets: align Astro base, Gateway prefix, and deployed client assets.

See [Astro configuration](https://docs.platformatic.dev/docs/reference/astro/configuration).
