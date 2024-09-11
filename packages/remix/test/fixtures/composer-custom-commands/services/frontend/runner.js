import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { createRequestHandler } from '@remix-run/express'
import express from 'express'
import { resolve } from 'node:path'
import { pinoHttp } from 'pino-http'

const app = express()
const basePath = globalThis.platformatic?.basePath ?? '/'

app.use(pinoHttp({ level: globalThis.platformatic?.logLevel ?? 'info' }))
app.use(ensureTrailingSlash(cleanBasePath(basePath)), express.static(resolve(process.cwd(), 'build/client')))
app.all(
  `${ensureTrailingSlash(cleanBasePath(basePath))}*`,
  createRequestHandler({ build: await import('./build/server/index.js') })
)
app.listen(3000)
