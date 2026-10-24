# React Router with Watt 4

Use `@platformatic/react-router` for framework-mode apps detected through
`react-router.config.*` or `@react-router/dev`, not client-only `react-router-dom`.
React Router v7 continues Remix v2; classic Remix uses [remix.md](remix.md).
Specific framework signals take precedence over `vite.config.*`.

Install compatible Watt 4 `wattpm` and capability packages only with authorization.
In an ESM TypeScript package, `watt.config.ts`:

```ts
import { createReactRouterConfig } from '@platformatic/react-router'

export default createReactRouterConfig({
  server: { port: Number(process.env.PORT || 3000) }
})
```

The capability handles default lifecycle commands. Preserve framework builds and
type checking; native config stripping does not compile TSX. Custom command pipelines
need the correct SSR output and their own listener/shutdown behavior.

## Gateway base path

When proxying under a prefix, align capability `application.basePath`, Gateway rewriting,
React Router `basename`, and Vite `base`. Retain the following pattern where supported:

```ts
import type { Config } from '@react-router/dev/config'
import { getBasePath } from '@platformatic/globals'

export default {
  basename: getBasePath({ throwOnMissing: false }) ?? '/',
  ssr: true
} satisfies Config
```

In `vite.config.ts`:

```ts
import { getBasePath } from '@platformatic/globals'
import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  base: getBasePath({ throwOnMissing: false }) ?? '/',
  plugins: [reactRouter(), tsconfigPaths()],
  server: { allowedHosts: ['.plt.local'] }
})
```

## Custom SSR entrypoint

For the supported custom SSR build path, preserve the existing pipeline and inspect
the installed capability before adding:

```ts
export default defineConfig(({ isSsrBuild }) => ({
  build: {
    rollupOptions: isSsrBuild ? { input: './app/server.ts' } : undefined
  },
  plugins: [reactRouter(), tsconfigPaths()]
}))
```

`app/server.ts` can expose `export const entrypoint = import('virtual:react-router/server-build')`.
This framework export is not the removed runtime `entrypoint` property.

## HTTPS and listener

Configure `server` on the React Router capability, not the runtime root. For HTTPS,
inspect its installed schema for certificate/key shapes before writing `server.https`.
Watt no longer rewrites ports. Dev mesh hosts need `.plt.local` allowed; never disable
the Vite host check globally.

## Common issues

- Misdetected as Vite: inspect framework config **and dependencies**.
- Prefix 404: verify `basename`, Vite base, Gateway prefix, and production assets.
- Missing SSR output: run build before production startup and ship the complete output.

See [React Router configuration](https://docs.platformatic.dev/docs/reference/react-router/configuration).
