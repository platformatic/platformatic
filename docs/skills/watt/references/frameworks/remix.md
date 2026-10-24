# Classic Remix with Watt 4

React Router v7 is the successor to Remix v2. Use [react-router.md](react-router.md)
for `react-router.config.*`/`@react-router/dev`; use `@platformatic/remix` for supported
classic Remix apps detected through `remix.config.*` or `@remix-run/dev`.

With permission, install compatible `wattpm` and `@platformatic/remix`. ESM config:

```js
import { createRemixConfig } from '@platformatic/remix'

export default createRemixConfig({
  server: { port: Number(process.env.PORT || 3000) }
})
```

## Compiler and server adapter

Preserve the installed Remix compiler and its supported capability contract:

| Existing pipeline | Typical build/output |
| --- | --- |
| Vite-based Remix v2 | `remix vite:build`, `build/server/index.js` |
| Classic compiler | `remix build`, configured `build` server output |

Do not substitute commands solely from the presence of Vite. Keep custom Express
adapter code, session/auth behavior, and asset serving. A deliberate generic Node
integration can use `@platformatic/node` for an unsupported custom server, but report
that choice rather than silently switching. Custom production commands choose their own
listener and cleanup; Watt no longer writes `PORT` or overrides listener addresses.

## Routes and deployment

Preserve loaders/actions, Vite plugin (`vitePlugin` from `@remix-run/dev`), and Classic
compiler module format. Ship public assets plus complete server build. Build before
Watt production startup; inspect `application.commands` only when defaults do not fit.

An application-owned `app/routes/health.tsx` loader can return a JSON health response.
Probe the actual path through Gateway, accounting for any base prefix. Check WebSocket
HMR and `.plt.local` allowed hosts for development instead of disabling Vite host checks.

## Sessions and database connections

Preserve session security (`httpOnly`, `secure` in production, `sameSite`, environment
secrets). `createCookieSessionStorage` stores session data in cookies; it is **not** a
database-backed session store. Use an actual server-side storage adapter when required.
Do not use fallback production secrets.

Initialize Prisma/DB clients outside request handlers and avoid duplicate clients during
development reload. Close pools through application lifecycle or `registerCloseCallback()`.
Keep the project's existing module/type conventions for any development global store.

## TypeScript and environment

Retain Remix builds/type checks; Node configuration stripping does not compile TSX or
replace framework transforms. Use `process.env` in server loaders and expose only intended
public values. Preserve `.env` handling and `SESSION_SECRET`, reading listener values
explicitly in the capability or retained custom server.

## Common issues

- Build failure: inspect compiler version/plugin and dependencies before adding packages.
- Static assets missing: inspect public paths, full build output, and Gateway rewriting.
- Custom server not recognized: check the capability entrypoint contract and preserve auth/shutdown.

See [Remix configuration](https://docs.platformatic.dev/docs/reference/remix/configuration).
