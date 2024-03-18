'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/hello', async () => {
    return { service: 'service-2' }
  })

  app.get('/large-logs', async (req) => {
    const largeLog = 'a'.repeat(5 * 1024 * 1024)
    for (let i = 0; i < 10; i++) {
      app.log.trace(largeLog)
    }
  })
}
