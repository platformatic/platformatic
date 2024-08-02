'use strict'

const fp = require('fastify-plugin')

function sanitizeSchemaRefs (schema) {
  const sanitizedSchema = Array.isArray(schema) ? [] : {}
  for (const key of Object.keys(schema)) {
    const value = schema[key]
    if (key === '$ref' && typeof value === 'string') {
      sanitizedSchema.$ref = value.replace('#/components/schemas/', '')
      continue
    }
    if (typeof value === 'object') {
      sanitizedSchema[key] = sanitizeSchemaRefs(value)
      continue
    }
    sanitizedSchema[key] = value
  }
  return sanitizedSchema
}

module.exports = fp(async function rpcPlugin (fastify, opts) {
  fastify.log.warn(
    'Platformatic RPC API is in the experimental stage. ' +
    'The feature is not subject to semantic versioning rules. ' +
    'Non-backward compatible changes or removal may occur in any future release. ' +
    'Use of the feature is not recommended in production environments.'
  )

  const openapiSchema = opts.openapi
  if (!openapiSchema) {
    throw new Error('openapi option is required')
  }

  const handlersSchemas = {}
  const pathSchemas = openapiSchema.paths
  for (const path in pathSchemas) {
    const pathSchema = pathSchemas[path].post
    if (!pathSchema) {
      throw new Error('Only POST method is supported')
    }

    const operationId = pathSchema.operationId
    if (!operationId) {
      throw new Error('operationId is required')
    }

    const bodySchema = pathSchema.requestBody?.content?.['application/json']?.schema
    const responseSchema = pathSchema.responses?.['200']?.content?.['application/json']?.schema

    handlersSchemas[operationId] = {
      body: bodySchema ? sanitizeSchemaRefs(bodySchema) : null,
      response: responseSchema ? sanitizeSchemaRefs(responseSchema) : null,
    }
  }

  const componentsSchemas = openapiSchema.components.schemas
  for (const componentSchemaId in componentsSchemas) {
    const componentsSchema = componentsSchemas[componentSchemaId]
    const sanitizedSchema = sanitizeSchemaRefs(componentsSchema)
    sanitizedSchema.$id = componentSchemaId
    fastify.addSchema(sanitizedSchema)
  }

  const prefix = opts.prefix ?? '/rpc'

  fastify.decorate('rpc', (handlerName, handler) => {
    const handlerSchemas = handlersSchemas[handlerName]

    const routeSchema = {}
    if (handlerSchemas.body) {
      routeSchema.body = handlerSchemas.body
    }
    if (handlerSchemas.response) {
      routeSchema.response = {
        200: handlerSchemas.response,
      }
    }

    fastify.route({
      method: 'POST',
      url: `${prefix}/${handlerName}`,
      schema: routeSchema,
      handler: async (req, reply) => {
        const args = req.body
        return handler(args)
      },
    })
  })
}, {
  name: 'fastify-rpc',
})
