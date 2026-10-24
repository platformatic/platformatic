# Fastify with Watt 4

Use `@platformatic/node` for an existing Fastify app, or `@platformatic/service` for
Platformatic plugin/routes/OpenAPI conventions. Install compatible Watt 4 packages
only with authorization. Do not silently convert between the two app contracts.

## Node capability

ESM `src/index.js`:

```js
import Fastify from 'fastify'

export async function create () {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL || 'info' }
  })
  app.get('/health', async () => ({ status: 'ok' }))
  return app
}
```

ESM `watt.config.js`:

```js
import { createNodeConfig } from '@platformatic/node'

export default createNodeConfig({
  main: './src/index.js',
  server: {
    hostname: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3000)
  }
})
```

Watt starts/closes the returned instance. Do not listen twice. For existing Fastify CLI
custom commands, preserve the pipeline only when needed and review child-process listener
and shutdown responsibilities in the [migration guide](../migration-v4.md).

## Platformatic Service

`watt.config.ts` for an ESM TypeScript plugin application:

```ts
import { createServiceConfig } from '@platformatic/service'

export default createServiceConfig({
  service: { openapi: true },
  plugins: { paths: ['./src/app.ts'] }
})
```

`src/app.ts`:

```ts
import type { FastifyInstance } from 'fastify'

export default async function (app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok' }))
  app.register(import('./routes/users.js'), { prefix: '/users' })
}
```

The route import must point at an existing plugin; retain the project's TS extension
resolution strategy. This internal Service example omits a public listener. Add capability
`server` only when needed. Shared decorators need non-encapsulated plugin paths and
Fastify type augmentation; see [services](../services.md).

With OpenAPI enabled, inspect the installed Service docs for `/documentation` and
`/documentation/json`; do not expose admin-only APIs through Gateway unintentionally.

## Plugins, autoload, and cleanup

Fastify plugins and Pino continue to work. Preserve CORS/helmet and existing plugin
encapsulation/prefixes. `@fastify/autoload` can load plugins and routes separately;
keep its paths relative to the actual module, using `node:path`/`node:url` for ESM.
Native TS stripping does not replace non-erasable transformations or type checking.

Use Fastify `onClose` hooks for its owned resources. Self-listening Node entrypoints
can export `close()`. Additional Watt cleanup uses `registerCloseCallback()`; legacy
`getGlobal()?.events?.on('close', ...)` no longer runs during Watt 4 shutdown.

## Common issues

- Plugin must be a function: register the imported plugin, not a package-name string.
- Address in use: inspect the actual listener; Watt does not select the next free port.
- Env validation: allow only required app variables and preserve existing validation.
- Slow startup: inspect plugin tree/build pipeline; profiling requires permission.
- Tests: use `inject()` and close the instance; capability tests are in [services](../services.md).
