# Framework integration with Watt 4

Read configuration and dependencies together. Specific framework dependencies take
precedence over shared Vite infrastructure, even when `vite.config.*` is present.

| Signal | Capability | Detailed reference |
| --- | --- | --- |
| `next.config.*` or `next` | `@platformatic/next` | [Next.js](frameworks/nextjs.md) |
| `nuxt.config.*` or `nuxt` | `@platformatic/nuxt` | [Nuxt](frameworks/nuxt.md) |
| Standalone `nitro`/`nitropack`, after specific framework checks | `@platformatic/nitro` | [Nitro](frameworks/nitro.md) |
| `react-router.config.*` or `@react-router/dev` | `@platformatic/react-router` | [React Router](frameworks/react-router.md) |
| `@tanstack/react-start`; inspect older `@tanstack/start` projects | `@platformatic/tanstack` | [TanStack](frameworks/tanstack.md) |
| `remix.config.*` or `@remix-run/dev` | `@platformatic/remix` | [Remix](frameworks/remix.md) |
| `astro.config.*` or `astro` | `@platformatic/astro` | [Astro](frameworks/astro.md) |
| `nest-cli.json` or `@nestjs/core` | `@platformatic/nest` | [NestJS](frameworks/nestjs.md) |
| Vite without a more specific match | `@platformatic/vite` | [Vite](frameworks/vite.md) |
| `express` | `@platformatic/node` | [Express](frameworks/express.md) |
| `fastify` | `@platformatic/node` | [Fastify](frameworks/fastify.md) |
| `koa` | `@platformatic/node` | [Koa](frameworks/koa.md) |
| Generic Node.js, including Hono with a Node server | `@platformatic/node` | [Node configuration](https://docs.platformatic.dev/docs/reference/node/configuration) |
| PHP, WordPress, Laravel | External `@platformatic/php` | [PHP compatibility](frameworks/php.md) |

Use a framework's scaffold only when explicitly requested for a new framework app.
Write Watt configuration directly. Preserve framework source/configuration and retain
original build/dev/start commands under clear script names when introducing Watt scripts.

## Configuration and dependencies

Install `wattpm` and the capability only with authorization, using the existing package
manager. Require compatible Watt 4 versions; external packages must be checked separately.
Inspect installed helper exports, schema, and supported framework versions.

For Next.js in an ESM TypeScript project:

```ts config
import { createNextConfig } from '@platformatic/next'

export default createNextConfig({
  server: { port: Number(process.env.PORT || 3000) }
})
```

Keep routes, images, React versions, and adapter/build choices intact. Standalone output
is a deployment choice, not a universal requirement. For other capabilities, use their
own helper or a versioned plain object with `module` and the actual schema shape.
Do not infer `application`, `commands`, or listener behavior from another framework.

## Node entrypoints

Prefer a factory returning the application or supported server rather than listening twice:

```js
import express from 'express'

export function create () {
  const app = express()
  app.get('/hello', (req, res) => {
    res.json({ hello: 'world' })
  })
  return app
}
```

Fastify factories return the instance. Koa needs a supported HTTP server adaptation;
read its guide before returning a raw callback. Use `main` in `createNodeConfig`, or
`node.main` in a plain object, pointing at actual source or production build output.

Self-listening in-thread entrypoints need a `close()` export or `registerCloseCallback()`
from `@platformatic/globals`. Custom commands run in child processes and must close their
own resources; exported factories/`close()` are not their shutdown contract.

## Verification

With permission, exercise dev startup, an endpoint, build, production startup, assets,
SSR, routing, and shutdown. `wattpm --version` alone does not verify integration.

See [framework guides](https://docs.platformatic.dev/docs/guides/frameworks) for
release-matched capability details.
