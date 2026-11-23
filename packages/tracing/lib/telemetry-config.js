import { FastifyOtelInstrumentation } from '@fastify/otel'
import { formatParamUrl } from '@fastify/swagger'
import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import fastUri from 'fast-uri'
import { setupDiagLogger } from './diag-logger.js'
import { getExternalTracerProvider, registerPropagation, registerTracerProvider } from './provider.js'
import { getSampler } from './samplers.js'
import { getSpanProcessors } from './span-processors.js'

import { name as moduleName, version as moduleVersion } from './version.js'

// Platformatic telemetry plugin.
// Supported Exporters:
// - console
// - otlp: (which also supports jaeger, see: https://opentelemetry.io/docs/instrumentation/js/exporters/#otlp-endpoint)
// - zipkin (https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-exporter-zipkin/README.md)
// - memory: for testing

export function formatSpanName (request, route) {
  if (route) {
    route = formatParamUrl(route)
  }

  const { method, url } = request
  return `${method} ${route ?? url}`
}

export const formatSpanAttributes = {
  request (request, route) {
    const { hostname, method, url, protocol = 'http' } = request
    // Inspired by: https://github.com/fastify/fastify-url-data/blob/master/plugin.js#L11
    const fullUrl = `${protocol}://${hostname}${url}`
    const urlData = fastUri.parse(fullUrl)

    const attributes = {
      'server.address': hostname,
      'server.port': urlData.port,
      'http.request.method': method,
      'url.full': fullUrl,
      'url.path': urlData.path,
      'url.scheme': protocol
    }

    if (route) {
      attributes['http.route'] = route
    }

    if (urlData.query) {
      attributes['url.query'] = urlData.query
    }

    if (urlData.fragment) {
      attributes['url.fragment'] = urlData.fragment
    }

    return attributes
  },
  reply (reply) {
    return {
      'http.response.status_code': reply.statusCode
    }
  },
  error (error) {
    return {
      'error.name': error.name,
      'error.message': error.message,
      'error.stack': error.stack
    }
  }
}

const initTelemetry = async (opts, logger) => {
  const tracer = trace.getTracer(moduleName, moduleVersion)

  // A provider registered by another party owns the telemetry pipeline: its exporters, sampler and
  // resource apply, and Platformatic only contributes its spans through the OpenTelemetry API.
  const externalProvider = getExternalTracerProvider()
  if (externalProvider) {
    if (opts.exporter) {
      logger.warn(
        'An OpenTelemetry TracerProvider is already registered, the exporters configured in the telemetry are ignored.'
      )
    }

    return {
      tracer,
      exporters: [],
      propagator: propagation,
      provider: externalProvider,
      spanProcessors: [],
      async shutdown () {}
    }
  }

  const { exporters, spanProcessors } = getSpanProcessors(opts, logger)
  const { applicationName, version } = opts
  const sampler = await getSampler(opts)

  const unregisterPropagation = registerPropagation()
  const { provider, unregisterTracerProvider } = registerTracerProvider({
    spanProcessors,
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: applicationName,
      [ATTR_SERVICE_VERSION]: version
    }),
    // Left out entirely when unconfigured, so the provider keeps its own default.
    ...(sampler ? { sampler } : {})
  })

  // The global registrations are removed along with the provider, so that the next application
  // started in the same thread does not mistake a terminated provider for an external one.
  async function shutdown () {
    unregisterTracerProvider()
    unregisterPropagation()
    await provider.shutdown()
  }

  return { tracer, exporters, propagator: propagation, provider, spanProcessors, shutdown }
}

export async function setupTelemetry (opts, logger) {
  setupDiagLogger(opts, logger)

  const { shutdown: shutdownProvider, ...openTelemetryAPIs } = await initTelemetry(opts, logger)
  const { tracer } = openTelemetryAPIs
  const skipOperations =
    opts?.skip?.map(skip => {
      const { method, path } = skip
      return `${method}${path}`
    }) || []

  // The server spans are created by the official Fastify instrumentation. Hook and handler spans are
  // disabled so that each request keeps producing a single span, which is then shaped to follow the
  // HTTP semantic conventions.
  const instrumentation = new FastifyOtelInstrumentation({
    instrumentHooks: false,
    instrumentHandler: false,
    ignorePaths ({ method, url }) {
      // This receives the route options (where the method can be a list) when the route is registered
      // and the request when it is received.
      const methods = Array.isArray(method) ? method : [method]
      return methods.every(candidate => skipOperations.includes(`${candidate}${url}`))
    },
    requestHook (span, request) {
      const route = request.routeOptions?.url ?? null
      span.updateName(formatSpanName(request, route))
      span.setAttributes(formatSpanAttributes.request(request, route))
    }
  })

  // Returns the context holding the server span of the request, falling back to the active one
  // for the requests that are not traced.
  const getRequestContext = request => {
    return request?.opentelemetry?.().context ?? context.active()
  }

  //* Client APIs
  const getSpanPropagationHeaders = (span, ctx = context.active()) => {
    const headers = {}
    propagation.inject(trace.setSpan(ctx, span), headers)
    return headers
  }

  // If a context is passed, is used. Otherwise the active one is used.
  // Note that in this case we don't set the span in request, as this is a client call.
  // So the client caller is responible of:
  // - setting the propagatorHeaders in the client request
  // - closing the span
  const startHTTPSpanClient = (url, method, ctx) => {
    ctx ??= context.active()
    const urlObj = fastUri.parse(url)

    if (skipOperations.includes(`${method}${urlObj.path}`)) {
      logger.debug({ operation: `${method}${urlObj.path}` }, 'Skipping telemetry')
      return
    }

    /* istanbul ignore next */
    method = method || ''
    let name
    if (urlObj.port) {
      name = `${method} ${urlObj.scheme}://${urlObj.host}:${urlObj.port}${urlObj.path}`
    } else {
      name = `${method} ${urlObj.scheme}://${urlObj.host}${urlObj.path}`
    }

    const span = tracer.startSpan(name, { kind: SpanKind.CLIENT }, ctx)

    /* istanbul ignore next */
    const attributes = url
      ? {
          'server.address': urlObj.host,
          'server.port': urlObj.port,
          'http.request.method': method,
          'url.full': url,
          'url.path': urlObj.path,
          'url.scheme': urlObj.scheme
        }
      : {}
    span.setAttributes(attributes)

    const telemetryHeaders = getSpanPropagationHeaders(span, ctx)
    return { span, telemetryHeaders }
  }

  const endHTTPSpanClient = (span, response) => {
    /* istanbul ignore next */
    if (!span) {
      return
    }
    if (response) {
      const spanStatus = { code: SpanStatusCode.OK }
      if (response.statusCode >= 400) {
        spanStatus.code = SpanStatusCode.ERROR
      }
      span.setAttributes({
        'http.response.status_code': response.statusCode
      })

      const httpCacheId = response.headers?.['x-plt-http-cache-id']
      const isCacheHit = response.headers?.age !== undefined
      if (httpCacheId) {
        span.setAttributes({
          'http.cache.id': httpCacheId,
          'http.cache.hit': isCacheHit.toString()
        })
      }

      span.setStatus(spanStatus)
    } else {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'No response received'
      })
    }
    span.end()
  }

  const setErrorInSpanClient = (span, error) => {
    /* istanbul ignore next */
    if (!span) {
      return
    }
    span.setAttributes(formatSpanAttributes.error(error))
  }

  // In the generic "startSpan" the attributes here are specified by the caller
  const startSpan = (name, ctx, attributes = {}, kind = SpanKind.INTERNAL) => {
    return tracer.startSpan(name, { kind, attributes }, ctx ?? context.active())
  }

  const endSpan = (span, error) => {
    /* istanbul ignore next */
    if (!span) {
      return
    }
    if (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      })
    } else {
      const spanStatus = { code: SpanStatusCode.OK }
      span.setStatus(spanStatus)
    }
    span.end()
  }

  // Unfortunately, this must be async, because of: https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_sdk_trace_base.SpanProcessor.html#shutdown
  const shutdown = async () => {
    try {
      instrumentation.disable()
      await shutdownProvider()
    } catch (err) {
      logger.error({ err }, 'Error shutting down telemetry provider')
    }
  }

  return {
    instrumentation,
    getRequestContext,
    getSpanPropagationHeaders,
    startHTTPSpanClient,
    endHTTPSpanClient,
    setErrorInSpanClient,
    startSpan,
    endSpan,
    shutdown,
    openTelemetryAPIs
  }
}
