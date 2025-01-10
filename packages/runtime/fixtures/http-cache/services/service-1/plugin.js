'use strict'

const { request } = require('undici')
const compress = require('@fastify/compress')

module.exports = async function (fastify) {
  let counter = 0

  fastify.get('/cached-req-counter', async (req, reply) => {
    const { maxAge, cacheTags } = req.query
    reply.header('Cache-Control', `public, s-maxage=${maxAge}`)

    if (cacheTags) {
      reply.header('Cache-Tags', cacheTags.join(','))
    }

    return { service: 'service-1', counter: ++counter }
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

  await fastify.register(async function (fastify) {
    await fastify.register(compress, { encodings: ['gzip'], threshold: 1 })

    let counter = 0

    fastify.get('/gzip-req-counter', async (req, reply) => {
      const { maxAge, cacheTags } = req.query
      reply.header('Cache-Control', `public, s-maxage=${maxAge}`)

      if (cacheTags) {
        reply.header('Cache-Tags', cacheTags.join(','))
      }

      return { service: 'service-1', counter: ++counter }
    })
  })
}
