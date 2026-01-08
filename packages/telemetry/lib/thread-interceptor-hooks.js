import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import fastUri from 'fast-uri'
import { formatSpanAttributes, formatSpanName } from './telemetry-config.js'
import { name as moduleName, version as moduleVersion } from './version.js'

// Get tracer from our isolated TracerProvider stored in globalThis.platformatic
function getTracer () {
  const tracerProvider = globalThis.platformatic?.tracerProvider
  if (tracerProvider) {
    return tracerProvider.getTracer(moduleName, moduleVersion)
  }
  // Fallback to global tracer if our provider isn't set up yet
  return trace.getTracer(moduleName, moduleVersion)
}

export function createTelemetryThreadInterceptorHooks () {
  const onServerRequest = (req, cb) => {
    const activeContext = propagation.extract(context.active(), req.headers)

    const route = req.routeOptions?.url ?? null
    const span = getTracer().startSpan(
      formatSpanName(req, route),
      {
        attributes: formatSpanAttributes.request(req, route),
        kind: SpanKind.SERVER
      },
      activeContext
    )
    const ctx = trace.setSpan(activeContext, span)

    context.with(ctx, cb)
  }

  const onServerResponse = (_req, _res) => {
    const activeContext = context.active()
    const span = trace.getSpan(activeContext)
    if (span) {
      span.end()
    }
  }

  const onServerError = (_req, _res, error) => {
    const activeContext = context.active()
    const span = trace.getSpan(activeContext)
    if (span) {
      span.setAttributes(formatSpanAttributes.error(error))
    }
  }

  const onClientRequest = (req, ctx) => {
    const activeContext = context.active()

    const { origin, method = '', path } = req
    const targetUrl = `${origin}${path}`
    const urlObj = fastUri.parse(targetUrl)

    let name
    if (urlObj.port) {
      name = `${method} ${urlObj.scheme}://${urlObj.host}:${urlObj.port}${urlObj.path}`
    } else {
      name = `${method} ${urlObj.scheme}://${urlObj.host}${urlObj.path}`
    }
    const span = getTracer().startSpan(
      name,
      {
        attributes: {
          'server.address': urlObj.host,
          'server.port': urlObj.port,
          'http.request.method': method,
          'url.full': targetUrl,
          'url.path': urlObj.path,
          'url.scheme': urlObj.scheme
        },
        kind: SpanKind.CLIENT
      },
      activeContext
    )

    // Headers propagation
    const headers = {}
    // This line is important, otherwise it will use the old context
    const newCtx = trace.setSpan(activeContext, span)
    propagation.inject(newCtx, headers, {
      set (_carrier, key, value) {
        headers[key] = value
      }
    })
    req.headers = {
      ...req.headers,
      ...headers
    }

    ctx.span = span
  }

  const onClientResponseEnd = (_req, res, ctx) => {
    const span = ctx.span ?? null
    if (!span) {
      return
    }
    if (res) {
      const spanStatus = { code: SpanStatusCode.OK }
      if (res.statusCode >= 400) {
        spanStatus.code = SpanStatusCode.ERROR
      }
      span.setAttributes({
        'http.response.status_code': res.statusCode
      })

      const httpCacheId = res.headers?.['x-plt-http-cache-id']
      const isCacheHit = res.headers?.age !== undefined
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

  const onClientError = (_req, _res, ctx, error) => {
    const span = ctx.span ?? null
    if (!span) {
      return
    }
    span.setAttributes(formatSpanAttributes.error(error))
  }

  return {
    onServerRequest,
    onServerResponse,
    onServerError,
    onClientRequest,
    onClientResponseEnd,
    onClientError
  }
}
