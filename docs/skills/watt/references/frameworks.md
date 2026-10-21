# Choose a Watt 3 capability

Inspect configuration and dependencies before choosing a capability. Match specific
frameworks before generic Vite: Nuxt, React Router, TanStack, Remix, and Astro can all
include Vite configuration. Preserve existing framework build configuration.

| Framework | Capability | Guide |
| --- | --- | --- |
| Next.js | `@platformatic/next` | [Next.js](frameworks/nextjs.md) |
| Nuxt | `@platformatic/nuxt` | [Nuxt](frameworks/nuxt.md) |
| Nitro | `@platformatic/nitro` | [Nitro](frameworks/nitro.md) |
| React Router | `@platformatic/react-router` | [React Router](frameworks/react-router.md) |
| TanStack Start | `@platformatic/tanstack` | [TanStack](frameworks/tanstack.md) |
| Vite | `@platformatic/vite` | [Vite](frameworks/vite.md) |
| Remix | `@platformatic/remix` | [Remix](frameworks/remix.md) |
| Astro | `@platformatic/astro` | [Astro](frameworks/astro.md) |
| Express | `@platformatic/node` | [Express](frameworks/express.md) |
| Fastify | `@platformatic/node` or `@platformatic/service` | [Fastify](frameworks/fastify.md) |
| Koa | `@platformatic/node` | [Koa](frameworks/koa.md) |
| NestJS | `@platformatic/node` | [NestJS](frameworks/nestjs.md) |
| PHP, WordPress, Laravel | External `@platformatic/php` | [PHP](frameworks/php.md) |

Use major 3 packages for this release line and verify external capabilities separately.
Examples use `module` to identify the capability without hardcoding a stale schema URL.
If adding `$schema`, stamp it with the installed capability's version.

For a standalone capability, public server and orchestration options can be wrapped
under `runtime`. In a multi-app project, keep orchestration at the root and capability
configuration in each app directory. See [integration](integration.md).
