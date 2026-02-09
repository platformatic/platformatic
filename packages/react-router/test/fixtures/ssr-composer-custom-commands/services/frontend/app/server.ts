import fastifyStatic from '@fastify/static'
import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import fastify from 'fastify'
import { join, resolve } from 'node:path'
import { createRequestHandler } from 'react-router'

function handleRequest (handle, req) {
  // Support aborting
  const ac = new AbortController()

  req.raw.on('aborted', () => ac.abort())
  req.raw.on('close', () => ac.abort())

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      headers.set(key, Array.isArray(value) ? value.join(',') : value)
    }
  }

  return handle(
    new Request(`${req.protocol}://${req.hostname}${req.raw.url}`, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : ReadableStream.from(req.raw),
      duplex: 'half',
      signal: ac.signal
    })
  )
}

const app = fastify({ loggerInstance: globalThis.platformatic?.logger })
const basePath = globalThis.platformatic?.basePath ?? '/'

await app.register(fastifyStatic, {
  root: resolve(process.cwd(), resolve(process.cwd(), 'build/client')),
  prefix: join(basePath, 'assets'),
  prefixAvoidTrailingSlash: true,
  schemaHide: true
})

await app.all(
  `${ensureTrailingSlash(cleanBasePath(basePath))}*`,
  handleRequest.bind(
    null,
    createRequestHandler(await import('virtual:react-router/server-build'), process.env.NODE_ENV)
  )
)

await app.listen({ port: 3000 })
