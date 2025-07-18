'use strict'

const { request } = require('undici')
const { getGreeting } = require('./deps/dep1')

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/', async () => {
    return { hello: await getGreeting() + '123' }
  })

  app.get('/upstream', async () => {
    const res = await request('http://with-logger.plt.local')
    const text = await res.body.text()
    return text
  })

  app.get('/unknown', async (_, reply) => {
    try {
      const res = await request('http://unknown.plt.local')
      const text = await res.body.text()
      return reply.code(500).send({
        msg: 'should not have reached here',
        text
      })
    } catch (err) {
      return {
        msg: err.message,
        code: err.code
      }
    }
  })

  app.get('/crash', () => {
    setImmediate(() => {
      throw new Error('boom')
    })

    return 'ok'
  })

  app.get('/env', () => {
    return process.env
  })

  app.get('/shared-context', { schema: { hide: true } }, async () => {
    return globalThis.platformatic.sharedContext.get()
  })

  app.patch('/shared-context', { shema: { hide: true } }, async (req, res) => {
    const { context, overwrite } = req.body
    globalThis.platformatic.sharedContext.update(context, { overwrite })
    res.status(200).send()
  })
}
