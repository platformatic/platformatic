import fastifyVite from '@fastify/vite'
import fastify from 'fastify'

export async function build () {
  const server = fastify({
    loggerInstance: globalThis.platformatic?.logger?.child({}, { level: globalThis.platformatic?.logLevel ?? 'info' })
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

  return server
}
