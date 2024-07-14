'use strict'

const { readFile } = require('node:fs/promises')
const fp = require('fastify-plugin')

module.exports = fp(async function rpcPlugin (fastify, opts) {
  const rpcHandlers = {}

  fastify.decorate('rpc', (handlerName, handler) => {
    rpcHandlers[handlerName] = handler
  })

  const openapiSchemaFile = await readFile(opts.openapiSchema, 'utf8')
  const openapiSchema = JSON.parse(openapiSchemaFile)

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
