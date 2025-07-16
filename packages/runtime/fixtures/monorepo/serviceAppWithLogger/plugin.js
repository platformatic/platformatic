'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/', async () => {
    return { hello: 'world' }
  })

  let crashOnClose = false
  app.get('/crash-on-close', { schema: { hide: true } }, async () => {
    crashOnClose = true
  })

  app.addHook('onClose', async () => {
    if (crashOnClose) {
      app.log.info('Crashing process on purpose')
      throw new Error('Crashing process on purpose')
    }
  })

  app.get('/shared-context', async () => {
    return globalThis.platformatic.sharedContext.get()
  })

  app.patch('/shared-context', async (req, res) => {
    const { context, overwrite } = req.body
    globalThis.platformatic.sharedContext.update(context, { overwrite })
    res.status(200).send()
  })
}
