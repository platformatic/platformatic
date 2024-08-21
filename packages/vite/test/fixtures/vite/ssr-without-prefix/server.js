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

  server.get('/', (req, reply) => {
    return reply.type('text/html').html()
  })

  server.get('/direct', (req, reply) => {
    return { ok: true }
  })

  server.get('/*', (req, reply) => {
    return reply.type('text/html').html()
  })

  return server
}
