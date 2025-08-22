'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app, options) {
  app.get('/application-1-time', async (request, reply) => {
    const response = await fetch('http://application-1.plt.local/time')

    reply.code(response.status)
    return response.json()
  })
}
