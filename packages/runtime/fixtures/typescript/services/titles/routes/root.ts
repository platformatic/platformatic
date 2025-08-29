/// <reference types="@platformatic/service" />
/// <reference types="../client" />
import { type FastifyInstance, type FastifyPluginOptions } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    example: string
  }
}

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.get('/', async (request, reply) => {
    return { hello: fastify.example }
  })

  fastify.get('/source-map-test', async (request, reply) => {
    const error = new Error('source-map-test')
    return error.stack
  })

  fastify.get('/titles', async (request, reply) => {
    const movies = await fastify.client.getMovies({})
    const titles = movies.map(movie => movie.title)
    return { titles }
  })
}
