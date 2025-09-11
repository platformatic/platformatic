'use strict'

module.exports = async function metricsPlugin (fastify) {
  fastify.get('/custom-prometheus-route', async function (request, reply) {
    return { ok: true }
  })
}
