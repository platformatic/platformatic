'use strict'

const { readFile } = require('node:fs/promises')
const { request, getGlobalDispatcher } = require('undici')
const fp = require('fastify-plugin')

const { modifyOpenApiSchema, originPathSymbol } = require('./openapi-modifier')
const composeOpenApi = require('./openapi-composer')
const loadOpenApiConfig = require('./load-openapi-config.js')

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

    let config = null
    if (openapi.config) {
      try {
        config = await loadOpenApiConfig(openapi.config)
      } catch (error) {
        app.log.error(error)
        throw new Error(`Could not read openapi config for "${id}" service`)
      }
    }

    let schema = null
    try {
      schema = await getOpenApiSchema(origin, openapi)
    } catch (error) {
      app.log.error(error, `failed to fetch schema for "${id} service"`)
      continue
    }

    schema = modifyOpenApiSchema(app, schema, config)

    const prefix = openapi.prefix ?? ''
    for (const path in schema.paths) {
      apiByApiRoutes[prefix + path] = {
        origin,
        prefix,
        schema: schema.paths[path]
      }
    }

    openApiSchemas.push({ id, prefix, schema, config })
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
      const { origin, prefix, schema } = apiByApiRoutes[openApiPath]
      const originPath = schema[originPathSymbol]

      const mapRoutePath = createPathMapper(originPath, openApiPath, prefix)

      return {
        config: { openApiPath },
        handler: (req, reply) => {
          const routePath = req.raw.url.split('?')[0]
          const newRoutePath = mapRoutePath(routePath)

          const replyOptions = {}
          if (req.routeConfig?.onComposerResponse) {
            replyOptions.onResponse = req.routeConfig.onComposerResponse
          }

          reply.from(origin + newRoutePath, replyOptions)
        }
      }
    }
  })
}

function createPathMapper (originOpenApiPath, renamedOpenApiPath, prefix) {
  if (prefix + originOpenApiPath === renamedOpenApiPath) {
    return (path) => path.slice(prefix.length)
  }

  const extractParamsRegexp = generateRouteRegex(renamedOpenApiPath)
  return (path) => {
    const routeParams = path.match(extractParamsRegexp).slice(1)
    return generateRenamedPath(originOpenApiPath, routeParams)
  }
}

function generateRouteRegex (route) {
  const regex = route.replace(/{(.*?)}/g, '(.*)')
  return new RegExp(regex)
}

function generateRenamedPath (renamedOpenApiPath, routeParams) {
  return renamedOpenApiPath.replace(/{(.*?)}/g, () => routeParams.shift())
}

module.exports = fp(composeOpenAPI)
