import fastifyStatic from '@fastify/static'
import { cleanBasePath } from '@platformatic/basic'
import { getBasePath, getLogger } from '@platformatic/globals'
import fastify from 'fastify'
import { resolve } from 'node:path'

const app = fastify({ loggerInstance: getLogger() })
const basePath = getBasePath({ throwOnMissing: false }) ?? '/'

await app.register(fastifyStatic, {
  root: resolve(process.cwd(), resolve(process.cwd(), 'build/client')),
  prefix: cleanBasePath(basePath),
  prefixAvoidTrailingSlash: true,
  schemaHide: true
})

await app.listen({ port: 3000 })
