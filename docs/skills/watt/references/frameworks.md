---
title: Integrate Frameworks with Watt
---

# Integrate frameworks with Watt

## Detect the capability

Read configuration files and dependencies together. Specific frameworks take precedence
over their shared Vite infrastructure; do not classify every `vite.config.*` as plain Vite.

| Signal | Capability |
| --- | --- |
| `next.config.*` or `next` | `@platformatic/next` |
| `nuxt.config.*` or `nuxt` | `@platformatic/nuxt` |
| `nitro` or `nitropack` | `@platformatic/nitro` |
| `react-router.config.*` or `@react-router/dev` | `@platformatic/react-router` |
| `@tanstack/react-start` | `@platformatic/tanstack` |
| `remix.config.*` or `@remix-run/dev` | `@platformatic/remix` |
| `astro.config.*` or `astro` | `@platformatic/astro` |
| `nest-cli.json` or `@nestjs/core` | `@platformatic/nest` |
| Vite without a more specific match | `@platformatic/vite` |
| Express, Fastify, Koa, or generic Node.js | `@platformatic/node` |
| PHP, WordPress, or Laravel | External `@platformatic/php` capability |

Use the framework's own scaffold only if explicitly requested for a new framework
application; Watt configuration itself is written directly. For an existing app,
keep the framework's source and configuration and preserve original scripts under
clear names when replacing `dev`, `build`, and `start` with Watt commands.

## Configuration and dependencies

Install `wattpm` and the capability using the existing package manager. Inspect the
installed capability's schema and helper exports; do not infer options from another
framework. External capabilities may not yet support Watt 4: check compatibility
and report a blocker instead of installing an incompatible package.

For Next.js, a minimal `watt.config.ts` is:

```ts config
import { createNextConfig } from '@platformatic/next'

export default createNextConfig({
  server: { port: Number(process.env.PORT || 3000) }
})
```

Keep `next.config.*`, routes, image configuration, React versions, and existing build
settings intact. Run `wattpm build` before `wattpm start`. Apply Next.js standalone
output only when the chosen deployment needs it; preserve any existing adapter setup.

For other capabilities, read their current configuration reference before writing
the matching typed helper call or a plain object with `module` and a versioned
`$schema`. Leave unspecified defaults to the capability rather than adding unsupported
`application`, `server`, or `commands` blocks from a generic template.

## Generic Node.js entrypoints

For Express, export a factory returning the application rather than listening twice:

```js source
import express from 'express'

export function create () {
  const app = express()
  app.get('/hello', (req, res) => {
    res.json({ hello: 'world' })
  })
  return app
}
```

For Fastify, return a Fastify instance. For Koa or a custom HTTP server, inspect the
Node capability's supported entrypoint contract before adapting it. When retaining
a self-listening entrypoint, supply a `close` export or a shutdown handler registered
through `@platformatic/globals`. Preserve standalone usage if the user needs it.

Configure `main` in `createNodeConfig`, or `node.main` in a plain-object definition,
to point to the actual file or production build output.
Keep the existing build command when source compilation is required. Confirm that
shutdown closes resources, connections, timers, and the HTTP server.

## Verification

With authorization, exercise development startup, a representative endpoint, framework
build, and production startup. Check SSR/static assets and routing for frontend apps.
Do not conclude integration is successful from `wattpm --version` alone.

See [framework guides](https://docs.platformatic.dev/docs/guides/frameworks) and the
matching capability configuration reference for exact options.
