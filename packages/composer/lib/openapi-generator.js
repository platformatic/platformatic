'use strict'

const { readFile } = require('node:fs/promises')

const { request, getGlobalDispatcher } = require('undici')
const fp = require('fastify-plugin')

const composeOpenApi = require('./openapi-composer')

async function fetchOpenApiSchema (openApiUrl) {
  const { body } = await request(openApiUrl)
  return body.json()
}

async function readOpenApiSchema (pathToSchema) {
  const schemaFile = await readFile(pathToSchema, 'utf-8')
  return JSON.parse(schemaFile)
}

async function getOpenApiSchema (origin, openapi) {
  if (openapi.url) {
    const openApiUrl = origin + openapi.url
    return fetchOpenApiSchema(openApiUrl)
  }

  return readOpenApiSchema(openapi.file)
}

async function composeOpenAPI (app, opts) {
  const { services } = opts

  const openApiSchemas = []
  const apiByApiRoutes = {}

  for (const { id, origin, openapi } of services) {
    if (!openapi) continue

    let schema = null
    try {
      schema = await getOpenApiSchema(origin, openapi)
    } catch (error) {
      app.log.error(error, `failed to fetch schema for "${id} service"`)
      continue
    }

    const prefix = openapi.prefix ?? ''
    const ignore = openapi.ignore ?? []

    for (const path in schema.paths) {
      apiByApiRoutes[prefix + path] = { origin, prefix }
    }
    openApiSchemas.push({ id, prefix, ignore, schema })
  }

  app.decorate('openApiSchemas', openApiSchemas)

  const composedOpenApiSchema = composeOpenApi(openApiSchemas, opts.openapi)

  const dispatcher = getGlobalDispatcher()

  await app.register(require('@fastify/reply-from'), {
    undici: dispatcher,
    destroyAgent: false
  })

  await app.register(await import('fastify-openapi-glue'), {
    specification: composedOpenApiSchema,
    operationResolver: (operationId, method, openApiPath) => {
      const { origin, prefix } = apiByApiRoutes[openApiPath]
      return {
        config: { openApiPath },
        handler: (req, reply) => {
          const path = req.raw.url.split('?')[0]

          const replyOptions = {}

          if (req.routeConfig?.onComposerResponse) {
            replyOptions.onResponse = req.routeConfig.onComposerResponse
          }

          reply.from(origin + path.slice(prefix.length), replyOptions)
        }
      }
    }
  })
}

module.exports = fp(composeOpenAPI)
