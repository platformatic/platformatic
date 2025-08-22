'use strict'

/** @param {import('fastify').FastifyInstance} app */
export default async function (app) {
  app.get('/query-params-array', async (req, res) => {
    const { ids } = req.query
    return {
      message: 'ok',
      data: ids
    }
  })
}
