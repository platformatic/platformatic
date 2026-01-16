import fastifyStatic from '@fastify/static'
import { cleanBasePath } from '@platformatic/basic'
import fastify from 'fastify'
import { resolve } from 'node:path'

const app = fastify({ loggerInstance: globalThis.platformatic?.logger })
const basePath = globalThis.platformatic?.basePath ?? '/'

await app.register(fastifyStatic, {
  root: resolve(process.cwd(), resolve(process.cwd(), 'build/client')),
  prefix: cleanBasePath(basePath),
  prefixAvoidTrailingSlash: true,
  schemaHide: true
})

await app.listen({ port: 3000 })
