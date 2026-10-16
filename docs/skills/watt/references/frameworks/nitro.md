# Nitro with Watt 4

Use `@platformatic/nitro` for standalone Nitro or plain Vite applications using
`nitro/vite`. Check Nuxt and TanStack first: a transitive Nitro dependency is not
enough to reclassify those frameworks. Install compatible Watt 4 packages only with permission.

ESM `watt.config.js`:

```js
import { createNitroConfig } from '@platformatic/nitro'

export default createNitroConfig({
  server: {
    hostname: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3000)
  }
})
```

The capability detects Vite configuration and uses its pipeline; without Vite it uses
the Nitro CLI. Preserve the project's source, adapters, and output conventions. The
default production output is `.output/server/index.mjs`; deploy all `.output`, not
only the entrypoint. Keep Watt packages/configuration when starting through Watt.

For Vite development mesh requests, add `server.allowedHosts: ['.plt.local']` without
replacing existing configuration. Configure listener addresses on the capability;
custom commands choose their own addresses and cleanup, not runtime-assigned ports.

Use `@platformatic/nitro/scheduler` for supported Nitro tasks; see
[scheduler](../scheduler.md). Native configuration type stripping does not replace
Vite/Nitro builds or type checks.

See [Nitro configuration](https://docs.platformatic.dev/docs/reference/nitro/configuration)
for output-directory and production-entrypoint options.
