'use strict'

/** @param {import('fastify').FastifyInstance} app */
export default async function (app) {
  app.get('/request-info', async (req, reply) => {
    return {
      method: 'GET',
      cache: 'no-store',
      mode: 'cors'
    }
  })
}
