'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/headers-info', async (req, reply) => {
    return {
      requiredHeader: req.headers['requiredheader'] || null,
      optionalHeader: req.headers['optionalheader'] || null
    }
  })
}
