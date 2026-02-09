---
title: Overview
label: Vite
---

import SharedOverview from '../node/\_shared-overview.md';

# Platformatic Vite

The Platformatic Vite allows to run a [Vite](https://vitejs.dev/) application as a Platformatic Runtime application with no modifications.

## Getting Started

Create or copy a Vite application inside the `applications`, `services` or `web` folder. If you are not using [`autoload`](../runtime/configuration.md#autoload), you also have to explictly add the new application.

You are all set, you can now start your runtime as usual via `wattpm dev` or `wattpm start`.

## Install

```bash
npm install @platformatic/vite
```

## Example configuration file

Create a `watt.json` in the root folder of your application with the following contents:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/vite/2.0.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Architecture

When running in development mode, the Vite development server is run a in worker thread in the same process of the Platformatic runtime. The server port is chosen randomly and it will override any user setting.

When running in production mode, a custom Fastify server will serve the built application. The application is run a in worker thread in the same process of the Platformatic runtime and it will not start a TCP server unless it's the runtime entrypoint.

In both modes if the application uses the `commands` property then it's responsible to start a HTTP server. The Platformatic runtime will modify the server port replacing it with a random port and then it will integrate the external application in the runtime.

## Integrating with other Watt applications

Due to [`CVE-2025-24010`](https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6), you need to set:

```js
{
  ...
  "server": {
    "allowedHosts": [".plt.local"]
  }
}
```

This will allow other applications inside the platformatic mesh network to contact your Vite server.

## SSR Entrypoint Example

If you are following [Vite SSR guide](https://vite.dev/guide/ssr.html) and you want to integrate with Watt, please replace your `server.js` file with one similar to the following:

```javascript
import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import express from 'express'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { createServer as createViteServer } from 'vite'

async function serve (vite, clientModule, req, res, next) {
  const url = req.originalUrl

  if (req.headers?.upgrade === 'websocket') {
    return next()
  }

  try {
    const { render } = await vite.ssrLoadModule(clientModule)
    const template = await vite.transformIndexHtml(
      url,
      await readFile(resolve(import.meta.dirname, 'index.html'), 'utf8')
    )

    const appHtml = await render(url)

    res
      .status(200)
      .set({ 'Content-Type': 'text/html' })
      .end(template.replace(`<!--ssr-outlet-->`, () => appHtml))
  } catch (e) {
    vite.ssrFixStacktrace(e)
    next(e)
  }
}

export async function build () {
  const clientModule = 'entry-server.js'

  const application = express()
  const server = createServer(application)

  const serverOptions = { middlewareMode: true }

  // In theory hmr: false should be enough, but in practice there is a bug in Vite which
  // will start the WebSocket server anyway. Completely disabling the websocket server
  // fixes the problem.
  if (process.env.NODE_ENV !== 'production') {
    serverOptions.hmr = { server }
  } else {
    serverOptions.hmr = false
    serverOptions.ws = false
  }

  const vite = await createViteServer({
    mode: process.env.NODE_ENV ?? 'development',
    configFile: resolve(import.meta.dirname, 'vite.config.js'),
    server: serverOptions,
    appType: 'custom'
  })

  // This is needed to correctly integrate with @platformatic/gateway
  server.vite = vite
  server.on('close', () => {
    vite.close()
  })

  const prefix = vite.config.base ?? ''
  const handler = serve.bind(null, vite, clientModule)

  if (vite.watcher && vite.ws) {
    const serverEntrypoint = resolve(vite.config.root, clientModule)

    vite.watcher.on('change', file => {
      if (file === serverEntrypoint) {
        vite.ws.send({ type: 'full-reload' })
      }
    })
  }

  application.use(ensureTrailingSlash(cleanBasePath(prefix)), handler)
  application.use(cleanBasePath(`${prefix}/*`), handler)
  application.use(vite.middlewares)

  return server
}
```

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
