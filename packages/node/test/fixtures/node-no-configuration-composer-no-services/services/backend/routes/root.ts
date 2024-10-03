/// <reference path="../global.d.ts" />
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    example: string
  }
}

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.get('/example', async (request, reply) => {
    return { hello: fastify.example }
  })

  fastify.get('/mesh', async () => {
    const response = await fetch('http://frontend.plt.local/direct')
    return response.json()
  })

  fastify.get('/time', async () => {
    return { time: Date.now() }
  })
}
