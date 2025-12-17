import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { createRequestHandler } from '@react-router/express'
import express from 'express'
import { resolve } from 'node:path'
import { pinoHttp } from 'pino-http'
import 'react-router'

const app = express()
const basePath = globalThis.platformatic?.basePath ?? '/'

app.use(pinoHttp({ level: globalThis.platformatic?.logLevel ?? 'info' }))
app.use(ensureTrailingSlash(cleanBasePath(basePath)), express.static(resolve(process.cwd(), 'build/client')))
app.use(
  `${ensureTrailingSlash(cleanBasePath(basePath))}*`,
  createRequestHandler({ build: () => import('virtual:react-router/server-build') })
)
app.listen(3000)
