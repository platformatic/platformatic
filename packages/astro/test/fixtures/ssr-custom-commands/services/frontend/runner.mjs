import middie from '@fastify/middie'
import fastifyStatic from '@fastify/static'
import { getBasePath, getLogLevel } from '@platformatic/globals'
import fastify from 'fastify'
import { resolve } from 'node:path'

const app = fastify({ logger: { level: getLogLevel(false) ?? 'info' } })
const { handler } = await import('./dist/server/entry.mjs')
const basePath = getBasePath(false) ?? '/'

await app.register(fastifyStatic, {
  root: resolve(process.cwd(), 'dist/client'),
  prefix: basePath,
  prefixAvoidTrailingSlash: true,
  schemaHide: true
})

await app.register(middie)
await app.use(basePath, handler)
await app.listen({ port: 3000 })
