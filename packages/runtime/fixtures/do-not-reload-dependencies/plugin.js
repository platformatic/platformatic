'use strict'

module.exports = function (fastify, opts, next) {
  fastify.get('/plugin1', function (request, reply) {
    const foo = require('foo')
    reply.send({ hello: foo })
  })

  fastify.get('/plugin2', async function (request, reply) {
    const foom = (await import('foom')).default
    return { hello: foom }
  })
  next()
}
