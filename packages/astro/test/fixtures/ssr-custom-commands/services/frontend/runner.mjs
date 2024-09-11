import middie from '@fastify/middie'
import fastifyStatic from '@fastify/static'
import fastify from 'fastify'
import { resolve } from 'node:path'

const app = fastify({ logger: { level: globalThis.platformatic?.logLevel ?? 'info' } })
const { handler } = await import('./dist/server/entry.mjs')
const basePath = globalThis.platformatic?.basePath ?? '/'

await app.register(fastifyStatic, {
  root: resolve(process.cwd(), 'dist/client'),
  prefix: basePath,
  prefixAvoidTrailingSlash: true,
  schemaHide: true
})

await app.register(middie)
await app.use(basePath, handler)
await app.listen({ port: 3000 })
