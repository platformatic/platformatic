/// <reference types="@platformatic/service" />
/// <reference types="../client" />
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    example: string
  }
}

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.get('/', async (request, reply) => {
    return { hello: fastify.example }
  })

  fastify.get('/titles', async (request, reply) => {
    const movies = await fastify.client.getMovies({})
    const titles = movies.map((movie) => movie.title)
    return { titles }
  })
}
