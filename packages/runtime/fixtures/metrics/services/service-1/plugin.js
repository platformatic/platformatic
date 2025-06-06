'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/hello', async () => {
    return { service: 'service-1' }
  })

  // 10 MB total
  app.get('/large-logs', async req => {
    const largeLog = 'a'.repeat(1000)
    for (let i = 0; i < 10000; i++) {
      app.log.trace(largeLog)
    }
  })
}
