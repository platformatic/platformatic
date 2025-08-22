'use strict'

/** @param {import('fastify').FastifyInstance} app */
export default async function (app) {
  app.get('/headers-info', async (req, reply) => {
    return {
      requiredHeader: req.headers['requiredheader'] || null,
      optionalHeader: req.headers['optionalheader'] || null
    }
  })
}
