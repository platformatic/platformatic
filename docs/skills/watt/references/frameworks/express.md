# Express on Watt 3

Use `@platformatic/node` for an existing Express application. Preserve middleware,
routers, error handling, and the project's ESM/CommonJS convention.

`watt.json`:

```json
{
  "module": "@platformatic/node",
  "node": { "main": "./server.js" },
  "runtime": { "server": { "hostname": "0.0.0.0", "port": "{PORT}" } }
}
```

An ESM entrypoint can export a factory without starting a second listener:

```js
import express from 'express'

export async function create () {
  const app = express()
  app.get('/health', (request, response) => response.json({ status: 'ok' }))
  return app
}
```

Install the matching major 3 Node capability and Watt with authorization. For CommonJS,
export the factory through `module.exports` instead of converting the entire project.

Review `trust proxy`, cookies, redirects, body size limits, and mounted path prefixes
behind a gateway. Server-side callers use `http://<application-id>.plt.local`.
Use the framework's error-handling conventions and stable application error codes.

For a self-listening entrypoint, preserve one owner for `listen()` and provide a
supported shutdown path for the HTTP server, timers, and external connections.
Test startup, representative routes, and graceful shutdown after integration.

See [integration](../integration.md) and [enterprise](../enterprise.md).
