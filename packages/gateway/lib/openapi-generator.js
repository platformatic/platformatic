import fastifyReplyFrom from '@fastify/reply-from'
import fastifySwagger from '@fastify/swagger'
import { getRuntimeBasePath } from '@platformatic/globals'
import { Validator } from '@platformatic/openapi-schema-validator'
import fp from 'fastify-plugin'
import { readFile } from 'node:fs/promises'
import { getGlobalDispatcher, request } from 'undici'
import { CouldNotReadOpenAPIConfigError, InvalidOpenAPISchemaError } from './errors.js'
import { composeOpenApi } from './openapi-composer.js'
import { loadOpenApiConfig } from './openapi-load-config.js'
import { modifyOpenApiSchema, originPathSymbol } from './openapi-modifier.js'
import { openApiScalar } from './openapi-scalar.js'
import { normalizePrefix, prefixWithSlash } from './utils.js'

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

const MAX_REPORTED_VALIDATION_ERRORS = 5

function escapeJsonPointerToken (token) {
  return token.replaceAll('~', '~0').replaceAll('/', '~1')
}

function findNullTypeConstructs (node, path = '#', found = []) {
  if (node === null || typeof node !== 'object') {
    return found
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      findNullTypeConstructs(node[i], `${path}/${i}`, found)
    }
    return found
  }

  if (node.type === 'null' || (Array.isArray(node.type) && node.type.includes('null'))) {
    found.push(`${path}/type`)
  }

  for (const key of Object.keys(node)) {
    findNullTypeConstructs(node[key], `${path}/${escapeJsonPointerToken(key)}`, found)
  }

  return found
}

function describeInvalidSchema (declaredVersion, errors, schema) {
  // The most common reason a composed specification is rejected: the document
  // declares OpenAPI 3.0.x but contains { "type": "null" }, which only exists
  // in OpenAPI 3.1. Report the exact location instead of the raw Ajv errors,
  // which only point at the enclosing anyOf/oneOf.
  if (typeof declaredVersion === 'string' && declaredVersion.startsWith('3.0')) {
    const nullTypes = findNullTypeConstructs(schema)

    if (nullTypes.length > 0) {
      return (
        `the document declares OpenAPI ${declaredVersion} but uses "type": "null", which only exists in OpenAPI 3.1, ` +
        `at ${nullTypes.join(', ')}. Replace it with "nullable": true or upgrade the document to OpenAPI 3.1.`
      )
    }
  }

  if (!Array.isArray(errors)) {
    return String(errors)
  }

  const reported = errors.slice(0, MAX_REPORTED_VALIDATION_ERRORS).map(error => {
    return `${error.instancePath || '#'} ${error.message}`
  })

  const remaining = errors.length - reported.length
  if (remaining > 0) {
    reported.push(`(${remaining} more errors)`)
  }

  return reported.join('; ')
}

async function findInvalidOpenApiSchemas (openApiSchemas, applications) {
  const validator = new Validator()
  const invalid = []

  for (const { id, schema } of openApiSchemas) {
    const result = await validator.validate(schema)

    if (result.valid) {
      continue
    }

    const application = applications.find(application => application.id === id)
    const source = application?.openapi?.url
      ? application.origin + prefixWithSlash(application.openapi.url)
      : application?.openapi?.file
    const declaredVersion = schema.openapi ?? schema.swagger

    invalid.push(
      `the schema of the "${id}" application (${source}) is not a valid OpenAPI document: ` +
        describeInvalidSchema(declaredVersion, result.errors, schema)
    )
  }

  return invalid
}

async function openApiGatewayPlugin (app, { opts, generated }) {
  const { apiByApiRoutes } = generated

  const dispatcher = getGlobalDispatcher()

  await app.register(fastifyReplyFrom, {
    undici: dispatcher,
    destroyAgent: false
  })

  const openApiGlue = await import('@platformatic/fastify-openapi-glue')

  try {
    await registerOpenApiGlue(app, openApiGlue, opts, apiByApiRoutes)
  } catch (error) {
    // The glue rejects the whole composed specification with a generic error.
    // Re-validate each downstream schema separately so the error names the
    // application and the source of the invalid document.
    const invalidSchemas = await findInvalidOpenApiSchemas(app.openApiSchemas, opts.applications)

    if (invalidSchemas.length === 0) {
      throw error
    }

    const invalidSchemaError = new InvalidOpenAPISchemaError(invalidSchemas.join('\n'))
    invalidSchemaError.cause = error
    throw invalidSchemaError
  }

  app.addHook('preValidation', async req => {
    if (typeof req.query.fields === 'string') {
      req.query.fields = req.query.fields.split(',')
    }
  })
}

async function registerOpenApiGlue (app, openApiGlue, opts, apiByApiRoutes) {
  await app.register(openApiGlue, {
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

            const onResponse = req.routeOptions.config?.onGatewayResponse ?? req.routeOptions.config?.onComposerResponse
            if (onResponse) {
              onResponse(request, reply, res.stream)
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
            // - request.proxedCallSpan: the span of the request to the proxied application
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
}

export async function openApiGenerator (app, opts) {
  if (!opts.applications.some(s => s.openapi)) {
    return
  }

  const { applications } = opts

  const openApiSchemas = []
  const apiByApiRoutes = {}

  // Fetch all the schemas in parallel, then process the results in the
  // original applications order so that composition stays deterministic.
  const fetchResults = await Promise.allSettled(
    applications.map(async ({ id, origin, openapi }) => {
      if (!openapi) return null

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
        app.log.error(error, `failed to fetch schema for "${id} application"`)
        return null
      }

      return { openapiConfig, originSchema }
    })
  )

  for (let i = 0; i < applications.length; i++) {
    const result = fetchResults[i]
    if (result.status === 'rejected') {
      throw result.reason
    }
    if (result.value === null) continue

    const { id, origin, openapi } = applications[i]
    const { openapiConfig, originSchema } = result.value

    const schema = modifyOpenApiSchema(app, originSchema, openapiConfig)

    const prefix = normalizePrefix(openapi.prefix)
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

  const swaggerOpenApi = {
    info: {
      title: opts.openapi?.title || 'Platformatic Gateway',
      version: opts.openapi?.version || '1.0.0'
    },
    servers: [{ url: getRuntimeBasePath({ throwOnMissing: false }) ?? '/' }],
    components: app.composedOpenApiSchema.components
  }

  if (app.composedOpenApiSchema.security) {
    swaggerOpenApi.security = app.composedOpenApiSchema.security
  }

  await app.register(fastifySwagger, {
    exposeRoute: true,
    openapi: swaggerOpenApi,
    transform ({ schema, url }) {
      for (const application of opts.applications) {
        if (!application.proxy) continue

        const prefix = application.proxy.prefix ?? ''
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

export const openApiGateway = fp(openApiGatewayPlugin)
