'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/', async () => {
    return { hello: 'world' }
  })

  let crashOnClose = false
  app.get('/crash-on-close', async () => {
    crashOnClose = true
  })

  app.addHook('onClose', async () => {
    if (crashOnClose) {
      app.log.info('Crashing process on purpose')
      throw new Error('Crashing process on purpose')
    }
  })
}
