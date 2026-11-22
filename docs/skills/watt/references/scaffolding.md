# Scaffold Watt applications

## Single application

Choose an unused project directory; do not initialize Git automatically. For a new
ESM project, set `"type": "module"`, `engines.node: ">=24.20.0"`, and these scripts:

```json
{
  "scripts": {
    "dev": "wattpm dev",
    "build": "wattpm build",
    "start": "wattpm start",
    "test": "node --test"
  }
}
```

With authorization, install `wattpm` and the chosen capability at compatible Watt 4
versions, using the existing package manager. For a Fastify app also install `fastify`
and `@platformatic/node`. Create `index.js`:

```js
import Fastify from 'fastify'

export function create () {
  const app = Fastify()
  app.get('/hello', async () => ({ hello: 'world' }))
  return app
}
```

Create `watt.config.js`:

```js config
import { createNodeConfig } from '@platformatic/node'

export default createNodeConfig({
  main: './index.js',
  server: {
    hostname: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3042)
  }
})
```

Add `.env.example` documenting `HOST=127.0.0.1` and `PORT=3042`; never replace `.env`.
Ignore dependencies, secrets, build output, logs, CPU profiles, and heap snapshots.
Document installation, development, build/start, and `/hello`. Tests can call `create()`,
use Fastify `inject()`, and close the instance in `t.after()`.

Native stripping of configuration types does not replace frontend builds or type checking.
Do not install TypeScript compilation tooling unless the application requires it.

## Workspace

Preserve existing layout, or use `applications/<id>/` for a new project. Put `wattpm`
at the root, and capability/framework dependencies in each owning application's manifest.
Declare npm/Yarn workspaces; Yarn also needs root `"private": true`. For pnpm:

```yaml
packages:
  - 'applications/*'
```

Root `watt.config.js`:

```js config
import { createWattConfig } from 'wattpm'

export default createWattConfig({
  logger: { level: process.env.LOG_LEVEL || 'info' },
  applications: [
    { id: 'api', path: './applications/api' },
    { id: 'gateway', path: './applications/gateway' }
  ]
})
```

Write the applications using [services](services.md) or [frameworks](frameworks.md).
The gateway's own capability configuration exposes the public listener. Internal calls
use `http://<id>.plt.local`. Check framework-specific listener requirements instead of
assuming every capability can start without a port.

Alternatively use `autoload: { path: './applications' }`. Do not accidentally combine
autoload and explicit entries or duplicate IDs.

## Add an application

1. Inspect the root configuration and workspace definitions.
2. Choose a unique ID and unused path; write the application and its own manifest/config.
3. Extend workspaces and `applications`, or rely on existing autoload. Edit dynamic exports
   minimally instead of replacing the root with a static object.
4. Preserve existing listeners and routing. There is no runtime `entrypoint` property.
5. Install and verify existing applications only with authorization.

## TypeScript

Use `.ts` configuration with erasable syntax, respecting package module type. For source,
retain the framework toolchain. New Node projects can use NodeNext, `noEmit`, `typescript`,
and `@types/node` for checking. Enums, decorators, parameter properties, and path aliases
need a separate runtime/build strategy.
