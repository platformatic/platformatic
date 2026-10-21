# Vite Integration with Platformatic Watt

## Package
```
@platformatic/vite
```

This capability runs a [Vite](https://vitejs.dev/) application as a Platformatic Runtime application with no modifications. Use it for plain Vite apps (SPA or custom SSR).

## Detection Files
- `vite.config.js`
- `vite.config.ts`
- `vite.config.mjs`

Vite is the fallback for Vite-based projects. Several frameworks build on Vite and have their own capability, so check for these first and only use `@platformatic/vite` when none of them match:

- `react-router.config.*` or `@react-router/dev` -> `@platformatic/react-router`
- `@tanstack/react-start` -> `@platformatic/tanstack`
- `nuxt.config.*` -> `@platformatic/nuxt`
- `remix.config.*` -> `@platformatic/remix`
- `astro.config.*` -> `@platformatic/astro`

## watt.json Configuration

Platformatic manages the development, build, and production lifecycle for you, so you do not need an `application.commands` block. A standalone Vite app used as the Watt entrypoint:

```json
{
  "module": "@platformatic/vite",
  "runtime": {
    "logger": {
      "level": "{PLT_SERVER_LOGGER_LEVEL}"
    },
    "server": {
      "hostname": "{PLT_SERVER_HOSTNAME}",
      "port": "{PORT}"
    }
  }
}
```

When the app runs behind a Platformatic Gateway under a path prefix, add `application.basePath`:

```json
{
  "module": "@platformatic/vite",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Installation

```bash
npm install wattpm@^3.74.0 @platformatic/vite@^3.74.0
```

## Key Considerations

### How Platformatic runs Vite
- Development: the Vite dev server runs in a worker thread inside the runtime process. Platformatic chooses a random port and overrides any user setting.
- Production: a Fastify server serves the built application from the same worker thread. It does not open a TCP server unless the app is the runtime entrypoint.

### No commands needed
Platformatic detects Vite and handles `dev`, `build`, and `production`. Only add `application.commands` if you need a custom command pipeline, in which case your command must start its own HTTP server.

### Mesh networking
Due to [CVE-2025-24010](https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6), the Vite dev server rejects unknown hosts. To let other Watt applications reach it, allow `.plt.local`:

```js
// vite.config.js
export default {
  server: {
    allowedHosts: ['.plt.local']
  }
}
```

### Custom SSR
For a custom Vite SSR setup, replace `server.js` with a module exporting an async `build()` function that returns the HTTP server. See the [Platformatic Vite overview](https://docs.platformatic.dev/docs/reference/vite/overview) for the full pattern.

## Environment Variables

```
PORT=3000
PLT_SERVER_HOSTNAME=0.0.0.0
PLT_SERVER_LOGGER_LEVEL=info
VITE_API_URL=https://api.example.com
```

Vite exposes only variables prefixed with `VITE_` to client code through `import.meta.env`.

## HTTPS

When a Vite app is the Watt entrypoint, configure HTTPS in the runtime `server.https`
object. This fragment belongs at the runtime root; wrap it in `runtime` for a standalone capability:

```json
{
  "server": {
    "https": {
      "key": { "path": "./certs/server.key" },
      "cert": { "path": "./certs/server.crt" }
    }
  }
}
```

In development Platformatic forwards the HTTPS options to the Vite dev server. In production it uses them for the Fastify server that serves the built app.

## TypeScript

Vite compiles framework/client TypeScript and JSX. Native Node.js type stripping can
load supported server-side TypeScript but does not replace the Vite build or type checking.

## Common Issues

### A framework was misdetected as Vite
React Router, TanStack Start, Remix, Astro, and Nuxt all use Vite. Check for their config files or dependencies and use the matching `@platformatic/*` capability instead.

### Dev server returns "host not allowed"
Add `'.plt.local'` to `server.allowedHosts` in `vite.config.*`.
