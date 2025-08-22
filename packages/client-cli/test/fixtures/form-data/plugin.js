'use strict'

/** @param {import('fastify').FastifyInstance} app */
export default async function (app) {
  if (!app.hasContentTypeParser('multipart')) {
    await app.register(import('@fastify/multipart'))
  }

  app.post('/upload', async (request, reply) => {
    const data = await request.file()
    return { success: true, fileName: data.filename }
  })
}
