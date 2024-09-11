import fastifyVite from '@fastify/vite'
import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import fastify from 'fastify'

export async function build () {
  const server = fastify({
    logger: globalThis.platformatic?.logger?.child({}, { level: globalThis.platformatic?.logLevel ?? 'info' })
  })

  await server.register(fastifyVite, {
    root: import.meta.url,
    dev: process.env.NODE_ENV !== 'production',
    createRenderFunction ({ generate }) {
      return async () => {
        return {
          element: await generate()
        }
      }
    },
    clientModule: 'index.js'
  })

  await server.vite.ready()
  const prefix = (server.vite.devServer?.config ?? server.vite.config.vite).base

  server.get(ensureTrailingSlash(cleanBasePath(prefix)), (req, reply) => {
    return reply.type('text/html').html()
  })

  if (!server.hasRoute({ url: cleanBasePath(`${prefix}/*`), method: 'GET' })) {
    server.get(cleanBasePath(`${prefix}/*`), (req, reply) => {
      return reply.type('text/html').html()
    })
  }

  server.get(cleanBasePath(`${prefix}/direct`), (req, reply) => {
    return { ok: true }
  })

  return server
}
