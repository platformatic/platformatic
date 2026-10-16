# Plain Vite with Watt 4

Use `@platformatic/vite` only after checking React Router, TanStack, Nuxt, Nitro,
Remix, and Astro configuration **and dependencies**. It supports plain SPA/custom SSR
projects; install compatible Watt 4 packages only with authorization.

ESM `watt.config.js`:

```js
import { createViteConfig } from '@platformatic/vite'

export default createViteConfig({
  server: {
    hostname: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3000)
  }
})
```

The default lifecycle uses Vite for development/build and serves the production build.
Do not add generic commands unless needed; a custom command must start and close its
own server. For prefixes, align `application.basePath`, Vite base, and Gateway rewriting.
Configure public listener/HTTPS on the capability, not the runtime root; inspect the
installed schema for TLS shapes and mode-specific listener behavior.

## Mesh host checks

Vite rejects unknown hosts to prevent DNS-rebinding attacks. Preserve other configuration
when allowing Watt's internal hosts:

```js
export default {
  server: { allowedHosts: ['.plt.local'] }
}
```

Do not disable host checking with `allowedHosts: true`. See the
[Vite advisory](https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6)
for the security reason for explicit host allowances.

## Custom SSR and environment

Inspect the installed capability's supported `build()` factory contract before adapting
a custom SSR server. Preserve Vite SSR output and framework tooling. See the
[Vite overview](https://docs.platformatic.dev/docs/reference/vite/overview) for the pattern.

Vite exposes only `VITE_*` variables to client code through `import.meta.env`; keep
secrets server-side. `PORT`/`HOST` in these examples are read by config explicitly,
not runtime-provided port overrides. Native TS stripping handles configuration, not TSX
bundling or type checking. Ship complete build output and build before `wattpm start`.

## Common issues

- Wrong capability: specific framework dependencies win over shared Vite config.
- “Host not allowed”: add `.plt.local` to the existing server allowed hosts.
- Missing assets/SSR: compare build output, base path, deployment assets, and Gateway routes.
