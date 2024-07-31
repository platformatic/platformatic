'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/return-headers', async (req, res) => {
    return {
      message: 'ok',
      data: {
        authorization: req.headers.authorization,
      },
    }
  })
}
