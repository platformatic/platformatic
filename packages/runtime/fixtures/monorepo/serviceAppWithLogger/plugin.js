/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  const { getSharedContext } = require('@platformatic/globals')

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

  app.get('/shared-context', { schema: { hide: true } }, async () => {
    const sharedContext = getSharedContext()
    return sharedContext.get()
  })

  app.patch('/shared-context', { schema: { hide: true } }, async (req, res) => {
    const { context, overwrite } = req.body
    const sharedContext = getSharedContext()
    sharedContext.update(context, { overwrite })
    res.status(200).send()
  })
}
