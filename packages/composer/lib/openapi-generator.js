'use strict'

const { readFile } = require('node:fs/promises')
const { request, getGlobalDispatcher } = require('undici')
const fp = require('fastify-plugin')
const errors = require('./errors')

const { modifyOpenApiSchema, originPathSymbol } = require('./openapi-modifier')
const composeOpenApi = require('./openapi-composer')
const loadOpenApiConfig = require('./openapi-load-config.js')
const { prefixWithSlash } = require('./utils.js')

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
    const openApiUrl = origin + prefixWithSlash(openapi.url)
    return fetchOpenApiSchema(openApiUrl)
  }

  return readOpenApiSchema(openapi.file)
}

async function composeOpenAPI (app, opts) {
  if (!opts.services.some(s => s.openapi)) { return }

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
        throw new errors.CouldNotReadOpenAPIConfigError(id)
      }
    }

    let originSchema = null
    try {
      originSchema = await getOpenApiSchema(origin, openapi)
    } catch (error) {
      app.log.error(error, `failed to fetch schema for "${id} service"`)
      continue
    }

    const schema = modifyOpenApiSchema(app, originSchema, config)

    const prefix = openapi.prefix ? prefixWithSlash(openapi.prefix) : ''
    for (const path in schema.paths) {
      apiByApiRoutes[prefix + path] = {
        origin,
        prefix,
        schema: schema.paths[path]
      }
    }

    openApiSchemas.push({ id, prefix, schema, originSchema, config })
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
          const onResponse = (request, reply, res) => {
            app.openTelemetry?.endSpanClient(reply.request.proxedCallSpan, { statusCode: reply.statusCode })
            if (req.routeOptions.config?.onComposerResponse) {
              req.routeOptions.config?.onComposerResponse(request, reply, res)
            } else {
              reply.send(res)
            }
          }
          const rewriteRequestHeaders = (request, headers) => {
            const targetUrl = `${origin}${request.url}`
            const context = request.span?.context
            const { span, telemetryHeaders } = app.openTelemetry?.startSpanClient(targetUrl, request.method, context) || { span: null, telemetryHeaders: {} }
            // We need to store the span in a different object
            // to correctly close it in the onResponse hook
            // Note that we have 2 spans:
            // - request.span: the span of the request to the proxy
            // - request.proxedCallSpan: the span of the request to the proxied service
            request.proxedCallSpan = span
            return { ...headers, ...telemetryHeaders }
          }
          replyOptions.onResponse = onResponse
          replyOptions.rewriteRequestHeaders = rewriteRequestHeaders

          reply.from(origin + newRoutePath, replyOptions)
        }
      }
    }
  })

  app.addHook('preValidation', async (req) => {
    if (typeof req.query.fields === 'string') {
      req.query.fields = req.query.fields.split(',')
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
