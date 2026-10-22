# Koa on Watt 3

Use `@platformatic/node` and preserve middleware order, context typing, and routing.

```json
{
  "module": "@platformatic/node",
  "node": { "main": "./server.js" },
  "runtime": { "server": { "hostname": "0.0.0.0", "port": "{PORT}" } }
}
```

```js
import Koa from 'koa'

export async function create () {
  const app = new Koa()
  app.use(async context => {
    context.body = { status: 'ok' }
  })
  return app
}
```

Avoid a second `listen()` call when Watt manages the factory. For existing self-listening
code, review the Node capability's close contract and close external resources explicitly.

Check proxy trust, secure cookies, redirects, request body limits, and path prefixes
behind a gateway. Keep error middleware in the project's established position and use
stable codes for application errors. Native TypeScript stripping does not support
every TypeScript construct; preserve a compile step when required.

See [integration](../integration.md) and [enterprise](../enterprise.md).
