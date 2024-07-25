'use strict'

const fp = require('fastify-plugin')

module.exports = fp(async function rpcPlugin (fastify, opts) {
  const openapiSchema = opts.openapi
  if (!openapiSchema) {
    throw new Error('openapi option is required')
  }

  const rpcHandlers = {}

  fastify.decorate('rpc', (handlerName, handler) => {
    rpcHandlers[handlerName] = handler
  })

  await fastify.register(await import('fastify-openapi-glue'), {
    specification: openapiSchema,
    addEmptySchema: true,
    prefix: opts.prefix ?? '/rpc',
    operationResolver: (operationId) => {
      return {
        handler: (req, reply) => {
          const args = req.body
          const rpcHandler = rpcHandlers[operationId]
          return rpcHandler(args)
        }
      }
    }
  })
}, {
  name: 'fastify-rpc'
})
