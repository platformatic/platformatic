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

  app.get('/crash', () => {
    setImmediate(() => {
      throw new Error('boom')
    })

    return 'ok'
  })

  app.get('/env', () => {
    return process.env
  })
}
