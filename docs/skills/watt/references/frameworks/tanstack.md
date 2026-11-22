# TanStack Start with Watt 4

Detect `@tanstack/react-start` in dependencies before falling back to Vite or Nitro.
Inspect older `@tanstack/start` projects and supported framework versions rather than
assuming their adapter contracts match. Use compatible `wattpm` and `@platformatic/tanstack`.

ESM `watt.config.ts`:

```ts
import { createTanstackConfig } from '@platformatic/tanstack'

export default createTanstackConfig({
  server: { port: Number(process.env.PORT || 3000) }
})
```

Verify the helper export against the installed package. The capability handles default
commands; keep custom build pipelines only when needed. For prefixes, inspect
`application.basePath`, router/Vite base, Gateway rewriting, and asset paths together.

## Production build

Retain the project's supported server adapter. For versions that use Nitro to emit a
Node server, a production-gated Vite plugin can be:

```js
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    // Keep the application's existing TanStack Start plugin here.
    process.env.NODE_ENV === 'production' && nitro({
      preset: 'node-server',
      output: { dir: 'dist' }
    })
  ],
  server: { allowedHosts: ['.plt.local'] }
})
```

This is a fragment to merge, not a replacement for the existing TanStack config.
Do not force a legacy Nitro recipe on versions using a different server build.
Custom production commands must target the actual output, such as `dist/server/index.mjs`.
Deploy complete output and run `wattpm build` before `start`.

## Listener, HTTPS, TypeScript

Configure the public listener on the capability; Watt no longer overrides ports.
Inspect capability `server.https` before configuring TLS. Keep frontend TypeScript
builds/type checking: native configuration stripping does not replace them.
Preserve existing environment names, reading listener values explicitly in config.

## Common issues

- Detected as plain Vite: check dependencies before selecting the fallback capability.
- No production server: inspect the installed TanStack version, adapter, and output.
- Mesh development rejected: allow `.plt.local` without globally disabling host checks.

See [TanStack configuration](https://docs.platformatic.dev/docs/reference/tanstack/configuration).
