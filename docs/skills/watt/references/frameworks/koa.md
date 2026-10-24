# Koa with Watt 4

Detect `koa` and use compatible `wattpm`/`@platformatic/node`. Preserve middleware,
routes, error handling, logger, and package manager; install only with permission.

## Factory and configuration

The Node capability recognizes a returned Koa instance. Prefer this contract instead
of returning only `app.callback()` or calling `listen()` inside a managed factory:

```js
import Koa from 'koa'
import Router from '@koa/router'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'

export function create () {
  const app = new Koa()
  const router = new Router()
  router.get('/health', ctx => {
    ctx.body = { status: 'ok' }
  })

  app.use(cors())
  app.use(bodyParser())
  app.use(router.routes())
  app.use(router.allowedMethods())
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

Match the actual path; use `.mjs` if the existing package is not ESM. For TS, preserve
its transform/type-checking toolchain and install matching Koa/router types as needed.

## Middleware and logging

Put error middleware first. Preserve status mapping, but do not expose internal error
messages to clients. Application errors should have stable codes following the app's
existing convention. Emit errors to the structured logger and redact secrets.

Pino request logging can record method, URL, status, and elapsed time around `await next()`.
Keep stateful middleware scoped to the app factory and retain `router.allowedMethods()`.
Do not remove existing sessions, authentication, or body limits when integrating.

## Standalone listeners and shutdown

A retained standalone entrypoint chooses its own address; Watt does not write `PORT`.
Use `0.0.0.0` for public containers, not all internal apps. For an in-thread self-listening
app, export an awaited `close()` for the existing server or register cleanup with
`registerCloseCallback()` from `@platformatic/globals`. Custom commands own child-process
cleanup. A process-only `SIGTERM` handler is not a substitute for Watt's worker lifecycle.

## Common issues

- TS context types: retain matching `@types/koa` and router package types.
- Middleware order: errors first, parsing before routes, auth before protected handlers.
- Response already sent: avoid continuing middleware after final responses.
- Prefix/listener problems: test Gateway routes, actual address, and internal application ID.
