# Nuxt Integration with Platformatic Watt

## Package
```
@platformatic/nuxt
```

This capability runs a [Nuxt](https://nuxt.com/) application as a Platformatic Runtime application with no modifications. Nuxt uses Vite internally, but it is managed through Nuxt and Nitro, not as a plain Vite application.

## Detection Files
- `nuxt.config.ts`
- `nuxt.config.js`
- `nuxt.config.mjs`

Backed by `nuxt` in dependencies.

## watt.json Configuration

Platformatic manages the development, build, and production lifecycle for you, so you do not need an `application.commands` block. A standalone Nuxt app used as the Watt entrypoint:

```json
{
  "module": "@platformatic/nuxt",
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
  "module": "@platformatic/nuxt",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Installation

```bash
npm install wattpm@^3.74.0 @platformatic/nuxt@^3.74.0
```

## Key Considerations

### No commands needed
Platformatic detects Nuxt and runs `dev`, `build`, and `production` itself. In production it runs the Nuxt/Nitro output produced by `nuxt build`. The default output directory is `.output` and the production entrypoint is `.output/server/index.mjs`.

### Deploy the whole .output directory
Nitro bundles the server, public assets, and copied runtime dependencies inside `.output`. Deploy the full directory, not only `.output/server/index.mjs`:

```bash
nuxt build
node .output/server/index.mjs
```

### Mesh networking
To let other Watt applications reach the Nuxt dev server, allow `.plt.local` hosts in `nuxt.config`:

```js
export default defineNuxtConfig({
  vite: {
    server: {
      allowedHosts: ['.plt.local']
    }
  }
})
```

### Port is managed by Platformatic
In development and production Platformatic selects the HTTP port used by the runtime. Do not hardcode a port.

## Environment Variables

```
PORT=3000
PLT_SERVER_HOSTNAME=0.0.0.0
PLT_SERVER_LOGGER_LEVEL=info
```

Use Nuxt runtime config to expose values to the app, reading them from `process.env`.

## TypeScript

Nuxt has built-in TypeScript support. No extra configuration is needed for Watt.

## Common Issues

### Production server not found
Confirm `nuxt build` ran and `.output/server/index.mjs` exists. Deploy the entire `.output` directory.

### Dev server unreachable from other applications
Add `'.plt.local'` to `vite.server.allowedHosts` in `nuxt.config`.
