# TanStack Start Integration with Platformatic Watt

## Package
```
@platformatic/tanstack
```

This capability runs a [TanStack Start](https://tanstack.com/start/) application as a Platformatic Runtime application with no modifications.

## Detection

TanStack Start is Vite-based and does not have a single dedicated config file, so detect it from dependencies in `package.json`:

- `@tanstack/react-start` (primary signal)
- `@tanstack/start` (older projects)

A TanStack Start app also has a `vite.config.{ts,js}` with the TanStack Start plugin. Detect TanStack from the dependency first; fall back to `@platformatic/vite` only when no TanStack Start dependency is present.

## watt.json Configuration

Platformatic manages the development, build, and production lifecycle for you, so you do not need an `application.commands` block. A standalone TanStack Start app used as the Watt entrypoint:

```json
{
  "module": "@platformatic/tanstack",
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
  "module": "@platformatic/tanstack",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Installation

```bash
npm install wattpm@^3.74.0 @platformatic/tanstack@^3.74.0
```

## Key Considerations

### Prepare the production build
TanStack Start needs Nitro to emit a Node.js server for production. Add the Nitro plugin to `vite.config.ts`, gated to production:

```javascript
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    // ...TanStack Start plugin
    process.env.NODE_ENV === 'production' &&
      nitro({
        preset: 'node-server',
        output: {
          dir: 'dist'
        }
      })
  ]
})
```

### No commands needed
Platformatic detects TanStack Start and runs `dev`, `build`, and `production` itself. Only add `application.commands` for a custom pipeline. If you do, point the production command at the Nitro Node server output (for example `node dist/server/index.mjs`).

### Port is managed by Platformatic
In development and production Platformatic chooses the HTTP port and overrides any user or application setting. Do not hardcode a port.

## Environment Variables

```
PORT=3000
PLT_SERVER_HOSTNAME=0.0.0.0
PLT_SERVER_LOGGER_LEVEL=info
```

## HTTPS

When TanStack Start is the Watt entrypoint, configure HTTPS in the runtime `server.https`
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

TanStack Start's build pipeline handles TypeScript and JSX. Native Node.js type stripping
can load supported server-side TypeScript but does not replace the framework build or type checking.

## Common Issues

### Detected as plain Vite
A TanStack Start app has a `vite.config.*`. If the skill picks `@platformatic/vite`, check `package.json` for `@tanstack/react-start` and switch to `@platformatic/tanstack`.

### Production build has no server output
The Nitro plugin is missing or not gated to production. Add `nitro({ preset: 'node-server' })` to the production branch of `vite.config.ts`.
