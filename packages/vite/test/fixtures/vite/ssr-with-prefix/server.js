import fastifyVite from '@fastify/vite'
import fastify from 'fastify'

export async function build () {
  const server = fastify()

  await server.register(fastifyVite, {
    root: import.meta.url,
    dev: true,
    createRenderFunction ({ generate }) {
      return async () => {
        return {
          element: await generate()
        }
      }
    }
  })

  await server.vite.ready()
  const prefix = server.vite.devServer.config.base.replace(/\/$/, '')

  server.get(prefix, (req, reply) => {
    return reply.type('text/html').html()
  })

  server.get(prefix + '/direct', (req, reply) => {
    return { ok: true }
  })

  server.get(prefix + '/*', (req, reply) => {
    return reply.type('text/html').html()
  })

  return server
}
