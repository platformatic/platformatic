import { type FastifyInstance, type FastifyPluginOptions } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    example: string
  }
}

export default async function  (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.get('/example', async (request, reply) => {
    return { hello: fastify.example }
  })

  // This purposely overlaps with frontend so that we can test route merging
  fastify.get(`$PREFIX/on-composer`, async (request, reply) => {
    return { ok: true }
  })
}
