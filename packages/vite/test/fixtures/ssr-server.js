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
    globalThis.platformatic?.logger?.info({ req: { host: req.hostname } }, 'incoming request')

    const { generate } = await vite.ssrLoadModule(clientModule)
    const template = await vite.transformIndexHtml(
      url,
      await readFile(resolve(import.meta.dirname, 'client/index.html'), 'utf8')
    )

    res
      .status(200)
      .set({ 'Content-Type': 'text/html' })
      .end(template.replace('<!-- element -->', await generate(url)))
  } catch (e) {
    vite.ssrFixStacktrace(e)
    next(e)
  }
}

export async function build () {
  const clientModule = 'index.js'

  const application = express()
  const server = createServer(application)

  const serverOptions = {
    middlewareMode: true
  }

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

  application.get(cleanBasePath(`${prefix}/direct`), (_, res) => {
    res.send({ ok: true })
  })

  application.use(ensureTrailingSlash(cleanBasePath(prefix)), handler)
  application.use(cleanBasePath(`${prefix}/*`), handler)
  application.use(vite.middlewares)

  return server
}

// This is to use with custom commands
if (import.meta.main) {
  const server = await build()
  server.listen({ port: 1 })
  setTimeout(() => {
    process._rawDebug('listening on port', server.address().port)
  }, 3000)
}
