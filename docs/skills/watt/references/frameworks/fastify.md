# Fastify on Watt 3

Choose `@platformatic/node` to preserve an existing Fastify server factory. Choose
`@platformatic/service` when the application should be a collection of Fastify plugins
with Platformatic's service features. Do not switch models unnecessarily.

## Existing server

```json
{
  "module": "@platformatic/node",
  "node": { "main": "./server.js" },
  "runtime": { "server": { "hostname": "0.0.0.0", "port": "{PORT}" } }
}
```

```js
import Fastify from 'fastify'

export async function create () {
  const app = Fastify()
  app.get('/health', async () => ({ status: 'ok' }))
  return app
}
```

Watt manages the returned instance's lifecycle. Register database and queue cleanup
with Fastify `onClose` hooks. Do not also call `listen()` in the factory.

## Service plugins

```json
{
  "module": "@platformatic/service",
  "plugins": { "paths": ["./app.js"] },
  "service": { "openapi": true }
}
```

```js
export default async function app (server) {
  server.get('/health', async () => ({ status: 'ok' }))
}
```

Keep plugin encapsulation, registration order, route schemas, authentication, and error
codes consistent with the project. Verify plugin compatibility with the installed
Fastify version. Reuse the server logger instead of introducing a parallel log pipeline.

For TypeScript, preserve the existing build when code needs more than native stripping.
Validate direct and gateway-prefixed routes, OpenAPI output, and shutdown.
See [services](../services.md) and [integration](../integration.md).
