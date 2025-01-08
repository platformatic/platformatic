'use strict'

const fastify = require('fastify')()
const messages = require('./messages')

function startOTEL (t, processSpans) {
  fastify.register(messages)

  fastify.post('/v1/traces', async (request, _reply) => {
    const { resourceSpans } = request.body
    processSpans(resourceSpans)
  })

  return fastify
}

module.exports = {
  startOTEL
}
