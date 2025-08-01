import { FastifyInstance, FastifyPluginOptions } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    example: string
  }
}

export default async function  (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.get('/example', async (request, reply) => {
    return { hello: fastify.example }
  })

  fastify.get('/mesh', async () => {
    // @ts-expect-error
    const meta = await globalThis[Symbol.for('plt.runtime.itc')].send('getServiceMeta', 'composer')

    const url = new URL(
      `${meta.composer.proxies.frontend.rewritePrefix}/direct`.replaceAll(/\/+/g, '/'),
      'http://frontend.plt.local'
    )
    const response = await fetch(url)
    return response.json()
  })

  fastify.get('/time', async () => {
    return { time: Date.now() }
  })
}
