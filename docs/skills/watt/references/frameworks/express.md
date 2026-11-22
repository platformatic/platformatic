# Express with Watt 4

Detect `express` in dependencies and the actual entrypoint (`package.json.main`,
`src/index.*`, `src/app.*`, `index.*`, or `server.*`). Install compatible `wattpm` and
`@platformatic/node` only with authorization, preserving the package manager.

## Managed factory

Prefer an ESM `create()` factory; preserve routes, middleware, authentication, and errors:

```js
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

export function create () {
  const app = express()
  app.use(helmet())
  app.use(cors())
  app.use(express.json())
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
  })
  return app
}
```

`watt.config.js` in an ESM project:

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

Match `main` to the actual factory path. For TS, native stripping is limited to erasable
syntax; keep compilation for framework transforms/aliases and point at build output.
The managed factory must not also call `listen()`.

## Existing self-listening apps

Preserve standalone usage when needed. The app chooses its own listener; Watt does not
write `PORT` or move it to the next free port. Bind public containers to `0.0.0.0`, not
every internal application. An in-thread self-listening entrypoint can export:

```js
export async function close () {
  await new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}
```

Here `server` is the application's existing listener. For extra asynchronous cleanup,
use `registerCloseCallback()` from `@platformatic/globals`, not legacy close events.
Custom-command child processes must register their own cleanup; Watt does not invoke
their exported factories/`close()` automatically. Do not register the same cleanup twice.

## Scripts and health

Use `wattpm dev`, `build`, `start`; preserve original scripts under clear names to avoid
recursive custom build commands. Remove PM2/forever only within the requested integration
scope. `/health` above is an application route, not an automatic Watt endpoint. Use it
for probes only after verifying the route through the deployed listener.

## Common issues

- Startup failure: inspect actual env requirements and configuration mode without dumping secrets.
- Container unreachable: confirm the public listener's hostname/port, not just `PORT` existence.
- Address in use: identify the owner before stopping anything; choose a new explicit port.
- Shutdown warnings: close servers, DB pools, timers, and resources using the correct execution mode.
