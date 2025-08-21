'use strict'

/** @param {import('fastify').FastifyInstance} app */
export default async function (app) {
  app.get('/simple-object', async (req, reply) => {
    return {
      name: 'simple object',
      value: 42,
      active: true
    }
  })
}
