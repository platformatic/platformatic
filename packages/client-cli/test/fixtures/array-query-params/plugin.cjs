'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/query-params-array', async (req, res) => {
    const { ids } = req.query
    return {
      message: 'ok',
      data: ids,
    }
  })
}
