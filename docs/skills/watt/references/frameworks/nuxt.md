# Nuxt with Watt 4

Detect `nuxt.config.*` and `nuxt` before plain Vite or Nitro. Use `@platformatic/nuxt`,
with compatible Watt 4 `wattpm`, installed only with authorization and the existing manager.

## Configuration

ESM `watt.config.js`:

```js
import { createNuxtConfig } from '@platformatic/nuxt'

export default createNuxtConfig({
  server: {
    hostname: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3000)
  }
})
```

Nuxt handles the default dev/build/production pipeline; do not add generic commands
unless needed. Preserve Nuxt runtime config and framework build/type-checking scripts.
For gateway prefixes, review `application.basePath`, Nuxt base URL, assets, and routing
together against the installed capability.

## Production output

Build before `wattpm start`. Nuxt/Nitro normally emits `.output/server/index.mjs`;
deploy the **whole `.output`** directory, including public assets and copied runtime
dependencies. Keep Watt configuration, manifests, runtime, and capability dependencies.
`node .output/server/index.mjs` is a standalone framework startup, not Watt orchestration.

## Mesh development hosts

Preserve other Nuxt options when adding:

```js
export default defineNuxtConfig({
  vite: {
    server: { allowedHosts: ['.plt.local'] }
  }
})
```

Do not set `allowedHosts: true`. The public listener is configured on the capability;
Watt no longer overrides application ports or writes `PORT`.

## Environment, TypeScript, and tasks

Read listener values in `watt.config.*` explicitly, and expose app values through Nuxt
runtime config. Keep Nuxt's TypeScript toolchain; native config stripping is not a build.
Nuxt scheduled tasks can use `@platformatic/nuxt/scheduler`; see [scheduler](../scheduler.md)
for retries, coordination, and at-least-once execution.

## Common issues

- Missing server output: run the existing Nuxt build and deploy all `.output`.
- Dev mesh unreachable: allow `.plt.local`, confirm the actual listener and application ID.
- Prefix 404/assets: verify Nuxt base URL and Gateway rewriting together.

See [Nuxt configuration](https://docs.platformatic.dev/docs/reference/nuxt/configuration).
