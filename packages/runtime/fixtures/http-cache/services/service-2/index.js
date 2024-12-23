'use strict'

const fastify = require('fastify')
const { request } = require('undici')

function build () {
  const app = fastify()

  let counter = 0

  app.get('/cached-req-counter', async (req, reply) => {
    const { maxAge } = req.query
    reply.header('Cache-Control', `public, s-maxage=${maxAge}`)
    return { service: 'service-2', counter: ++counter }
  })

  app.get('/service-3/cached-req-counter', async (req, reply) => {
    const res = await request('http://service-3.plt.local/cached-req-counter', {
      query: req.query,
      headers: req.headers
    })

    reply.status(res.statusCode)
    reply.headers(res.headers)

    const body = await res.body.text()
    return body
  })

  app.get('/service-3-http/cached-req-counter', async (req, reply) => {
    const res = await request('http://127.0.0.1:7866/service-3/cached-req-counter', {
      query: req.query,
      headers: req.headers
    })

    reply.status(res.statusCode)
    reply.headers(res.headers)

    const body = await res.body.text()
    return body
  })

  app.post('/invalidate-cache', async (req) => {
    const opts = req.body
    await globalThis.platformatic.invalidateHttpCache(opts)
  })

  return app
}

module.exports = { build }
