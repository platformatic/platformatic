import fastifyReplyFrom from '@fastify/reply-from'
import fastifySwagger from '@fastify/swagger'
import fp from 'fastify-plugin'
import { readFile } from 'node:fs/promises'
import { getGlobalDispatcher, request } from 'undici'
import { CouldNotReadOpenAPIConfigError } from './errors.js'
import { composeOpenApi } from './openapi-composer.js'
import { loadOpenApiConfig } from './openapi-load-config.js'
import { modifyOpenApiSchema, originPathSymbol } from './openapi-modifier.js'
import { openApiScalar } from './openapi-scalar.js'
import { prefixWithSlash } from './utils.js'

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

function createPathMapper (originOpenApiPath, renamedOpenApiPath, prefix) {
  if (prefix + originOpenApiPath === renamedOpenApiPath) {
    return path => path.slice(prefix.length)
  }

  const extractParamsRegexp = generateRouteRegex(renamedOpenApiPath)
  return path => {
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

async function openApiComposerPlugin (app, { opts, generated }) {
  const { apiByApiRoutes } = generated

  const dispatcher = getGlobalDispatcher()

  await app.register(fastifyReplyFrom, {
    undici: dispatcher,
    destroyAgent: false
  })

  await app.register(await import('@platformatic/fastify-openapi-glue'), {
    specification: app.composedOpenApiSchema,
    addEmptySchema: opts.addEmptySchema,
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
            app.openTelemetry?.endHTTPSpanClient(reply.request.proxedCallSpan, {
              statusCode: reply.statusCode,
              headers: res.headers
            })
            if (req.routeOptions.config?.onComposerResponse) {
              req.routeOptions.config?.onComposerResponse(request, reply, res.stream)
            } else {
              reply.send(res.stream)
            }
          }
          const rewriteRequestHeaders = (request, headers) => {
            const targetUrl = `${origin}${request.url}`
            const context = request.span?.context
            const { span, telemetryHeaders } = app.openTelemetry?.startHTTPSpanClient(
              targetUrl,
              request.method,
              context
            ) || { span: null, telemetryHeaders: {} }
            // We need to store the span in a different object
            // to correctly close it in the onResponse hook
            // Note that we have 2 spans:
            // - request.span: the span of the request to the proxy
            // - request.proxedCallSpan: the span of the request to the proxied service
            request.proxedCallSpan = span

            headers = {
              ...headers,
              ...telemetryHeaders,
              'x-forwarded-for': request.ip,
              'x-forwarded-host': request.host
            }

            return headers
          }
          replyOptions.onResponse = onResponse
          replyOptions.rewriteRequestHeaders = rewriteRequestHeaders

          reply.from(origin + newRoutePath, replyOptions)
        }
      }
    }
  })

  app.addHook('preValidation', async req => {
    if (typeof req.query.fields === 'string') {
      req.query.fields = req.query.fields.split(',')
    }
  })
}

export async function openApiGenerator (app, opts) {
  if (!opts.services.some(s => s.openapi)) {
    return
  }

  const { services } = opts

  const openApiSchemas = []
  const apiByApiRoutes = {}

  for (const { id, origin, openapi } of services) {
    if (!openapi) continue

    let openapiConfig = null
    if (openapi.config) {
      try {
        openapiConfig = await loadOpenApiConfig(openapi.config)
      } catch (error) {
        app.log.error(error)
        throw new CouldNotReadOpenAPIConfigError(id)
      }
    }

    let originSchema = null
    try {
      originSchema = await getOpenApiSchema(origin, openapi)
    } catch (error) {
      app.log.error(error, `failed to fetch schema for "${id} service"`)
      continue
    }

    const schema = modifyOpenApiSchema(app, originSchema, openapiConfig)

    const prefix = openapi.prefix ? prefixWithSlash(openapi.prefix) : ''
    for (const path in schema.paths) {
      apiByApiRoutes[prefix + path] = {
        origin,
        prefix,
        schema: schema.paths[path]
      }
    }

    openApiSchemas.push({ id, prefix, schema, originSchema, config: openapiConfig })
  }

  const composedOpenApiSchema = composeOpenApi(openApiSchemas, opts.openapi)

  app.decorate('openApiSchemas', openApiSchemas)
  app.decorate('composedOpenApiSchema', composedOpenApiSchema)

  await app.register(fastifySwagger, {
    exposeRoute: true,
    openapi: {
      info: {
        title: opts.openapi?.title || 'Platformatic Composer',
        version: opts.openapi?.version || '1.0.0'
      },
      servers: [{ url: globalThis.platformatic?.runtimeBasePath ?? '/' }],
      components: app.composedOpenApiSchema.components
    },
    transform ({ schema, url }) {
      for (const service of opts.services) {
        if (!service.proxy) continue

        const prefix = service.proxy.prefix ?? ''
        const proxyPrefix = prefix.at(-1) === '/' ? prefix.slice(0, -1) : prefix

        const proxyUrls = [proxyPrefix + '/', proxyPrefix + '/*']
        if (proxyUrls.includes(url)) {
          schema = schema ?? {}
          schema.hide = true
          break
        }
      }
      return { schema, url }
    }
  })

  await app.register(openApiScalar, opts)

  return { apiByApiRoutes }
}

export const openApiComposer = fp(openApiComposerPlugin)
