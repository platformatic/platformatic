# React Router Integration with Platformatic Watt

## Package
```
@platformatic/react-router
```

This capability runs a [React Router](https://reactrouter.com/) (formerly Remix) application as a Platformatic Runtime application with no modifications. Use it for React Router framework mode / React Router Start apps, not for plain client-side `react-router-dom` routing inside another framework.

> React Router v7 is the continuation of Remix. For classic Remix v1/v2 projects (`remix.config.js`), use [remix.md](remix.md) and `@platformatic/remix` instead.

## Detection Files
- `react-router.config.ts`
- `react-router.config.js`

Backed by `@react-router/dev` in dependencies. React Router apps are Vite-based, so they also have a `vite.config.{ts,js}`. Detect React Router from `react-router.config.*` first; fall back to `@platformatic/vite` only when no `react-router.config.*` is present.

## watt.json Configuration

Platformatic manages the development, build, and production lifecycle for you, so you do not need an `application.commands` block. A standalone React Router app used as the Watt entrypoint:

```json
{
  "module": "@platformatic/react-router",
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
  "module": "@platformatic/react-router",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Installation

```bash
npm install wattpm@^3.74.0 @platformatic/react-router@^3.74.0
```

## Key Considerations

### No commands needed
Platformatic detects React Router and runs `dev`, `build`, and `production` itself. Only add `application.commands` if you need a custom command pipeline. The default production server is started by Platformatic from the SSR build output.

### Running behind a Gateway
When the entrypoint is a Platformatic Gateway, the app must honor the base path. Update `react-router.config.ts`:

```typescript
import type { Config } from '@react-router/dev/config'
import { getBasePath } from '@platformatic/globals'

export default {
  basename: getBasePath({ throwOnMissing: false }) ?? '/',
  ssr: true
} satisfies Config
```

And `vite.config.ts`:

```typescript
import { getBasePath } from '@platformatic/globals'
import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  base: getBasePath({ throwOnMissing: false }) ?? '/',
  plugins: [reactRouter(), tsconfigPaths()]
})
```

### Mesh networking
Allow other Watt applications to reach the dev server by adding `.plt.local` to the Vite allowed hosts in `vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [reactRouter()],
  server: {
    allowedHosts: ['.plt.local']
  }
})
```

### Custom SSR entrypoint
To provide a custom server entrypoint, make the Vite SSR build depend on the SSR flag and export an `entrypoint` from `app/server.ts`:

```typescript
// vite.config.ts
export default defineConfig(({ isSsrBuild }) => ({
  base: getBasePath({ throwOnMissing: false }) ?? '/',
  build: {
    rollupOptions: isSsrBuild ? { input: './app/server.ts' } : undefined
  },
  plugins: [reactRouter(), tsconfigPaths()]
}))
```

```typescript
// app/server.ts
export const entrypoint = import('virtual:react-router/server-build')
```

### Port is managed by Platformatic
In development and production Platformatic chooses the HTTP port and overrides any user or application setting. Do not hardcode a port in the app.

## Environment Variables

```
PORT=3000
PLT_SERVER_HOSTNAME=0.0.0.0
PLT_SERVER_LOGGER_LEVEL=info
```

## HTTPS

When React Router is the Watt entrypoint, configure HTTPS in the runtime `server.https`
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

## TypeScript

React Router's build pipeline handles TypeScript and JSX. Native Node.js type stripping
can load supported server-side TypeScript but does not replace the framework build or type checking.

## Common Issues

### Detected as plain Vite
A React Router app has a `vite.config.*`. If the skill picks `@platformatic/vite`, check for `react-router.config.*` and switch to `@platformatic/react-router`.

### Routes 404 behind a Gateway
The base path is not wired up. Set `basename` in `react-router.config.ts` and `base` in `vite.config.ts` with `getBasePath()` from `@platformatic/globals`.

### Dev server unreachable from other applications
Add `'.plt.local'` to `server.allowedHosts` in `vite.config.ts`.
