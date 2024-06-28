'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/hello', async () => {
    return { service: 'service-2' }
  })

  app.get('/large-logs', async (req) => {
    const largeLog = 'a'.repeat(100)
    for (let i = 0; i < 500000; i++) {
      app.log.trace(largeLog)
    }
  })
}
