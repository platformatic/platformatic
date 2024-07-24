'use strict'

const fp = require('fastify-plugin')

module.exports = fp(async function rpcPlugin (fastify, opts) {
  const openapiSchema = opts.openapiSchema
  if (!openapiSchema) {
    throw new Error('openapiSchema option is required')
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
