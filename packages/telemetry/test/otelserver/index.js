import fastify from 'fastify'
import messages from './messages.js'

const server = fastify()

export function startOTEL (t, processSpans) {
  server.register(messages)

  server.post('/v1/traces', async (request, _reply) => {
    const { resourceSpans } = request.body
    processSpans(resourceSpans)
  })

  return server
}
