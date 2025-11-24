import type { FastifyReply, FastifyRequest } from 'fastify'

export default {
  preValidation: async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers['upgrade'] === 'websocket') {
      return true
    }

    if (!request.headers['content-type']?.includes('application/json')) {
      reply.code(400).send({ error: 'Content-Type must be application/json' })
      return false
    }
  },
  getUpstream: (request: FastifyRequest, base: string) => {
    const body = request.body

    if (body.message === 'go to one') {
      return globalThis.customProxyServiceOne
    } else if (body.message === 'go to two') {
      return globalThis.customProxyServiceTwo
    }

    return base
  }
}
