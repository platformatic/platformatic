'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  if (!app.hasContentTypeParser('multipart')) {
    await app.register(import('@fastify/multipart'))
  }

  app.post('/upload', async (request, reply) => {
    const data = await request.file()
    const fields = {}

    for (const [key, value] of Object.entries(request.body || {})) {
      fields[key] = value
    }

    return {
      success: true,
      fileName: data.filename,
      description: fields.description
    }
  })
}
