'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app, options) {
  app.get('/hello', async () => {
    return { service: 'service-2' }
  })

  app.get('/crash', async () => {
    setTimeout(() => {
      process.exit(1)
    }, 1000)

    return { ok: true }
  })
}
