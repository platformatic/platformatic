'use strict'

const { request } = require('undici')

module.exports = async function (fastify) {
  let counter = 0

  fastify.get('/cached-req-counter', async (req, reply) => {
    const { maxAge } = req.query
    reply.header('Cache-Control', `public, s-maxage=${maxAge}`)
    return { service: 'service-2', counter: ++counter }
  })

  fastify.get('/service-3/cached-req-counter', async (req, reply) => {
    const res = await request('http://service-3.plt.local/cached-req-counter', {
      query: req.query,
      headers: req.headers
    })

    reply.status(res.statusCode)
    reply.headers(res.headers)

    const body = await res.body.text()
    return body
  })

  fastify.post('/invalidate-cache', async (req) => {
    const opts = req.body
    await globalThis.platformatic.invalidateHttpCache(opts)
  })
}
