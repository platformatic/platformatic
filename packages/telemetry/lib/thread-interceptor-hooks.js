'use strict'

const { SpanStatusCode, SpanKind } = require('@opentelemetry/api')
const { formatSpanName, formatSpanAttributes, extractPath } = require('./telemetry-config')
const api = require('@opentelemetry/api')
const fastUri = require('fast-uri')

const tracer = api.trace.getTracer('thread-interceptor-hooks', '0.1.0')

const createTelemetryThreadInterceptorHooks = () => {
  let _getCurrentRequestContext = () => {
    return api.context.active()
  }

  const onServerRequest = (req) => {
    const activeContext = api.propagation.extract(api.context.active(), req.headers)

    const path = extractPath(req)
    const span = tracer.startSpan(formatSpanName(req, path), {
      attributes: formatSpanAttributes.request(req, path),
      kind: SpanKind.SERVER
    }, activeContext)
    const ctx = api.trace.setSpan(activeContext, span)

    // We need to bind the function to the correct context to set a context as "active" :(
    // https://open-telemetry.github.io/opentelemetry-js/classes/_opentelemetry_api.ContextAPI.html#bind
    // Using a `with` is not a not an option becasue the hooks are triggered by the interceptor.
    _getCurrentRequestContext = api.context.bind(ctx, () => {
      return api.context.active()
    })
    // We pass it directly to the next server hooks
    req.span = span
  }

  const onServerResponse = (req, res) => {
    const span = req.span
    span.end()
  }

  const onServerError = (req, res, error) => {
    const span = res.span
    span.setAttributes(formatSpanAttributes.error(error))
  }

  const onClientRequest = (req, ctx) => {
    // use the request context if set
    api.context.with(_getCurrentRequestContext(), () => {
      // If there is already a span in the context the subsequent span is
      // a child of the current span. Otherwise, we propagate the headers if present
      const activeContext = api.context.active()

      const { origin, method = '', path } = req
      const targetUrl = `${origin}${path}`
      const urlObj = fastUri.parse(targetUrl)

      let name
      if (urlObj.port) {
        name = `${method} ${urlObj.scheme}://${urlObj.host}:${urlObj.port}${urlObj.path}`
      } else {
        name = `${method} ${urlObj.scheme}://${urlObj.host}${urlObj.path}`
      }
      const span = tracer.startSpan(name, {
        attributes: {
          'server.address': urlObj.host,
          'server.port': urlObj.port,
          'http.request.method': method,
          'url.full': targetUrl,
          'url.path': urlObj.path,
          'url.scheme': urlObj.scheme,
        },
        kind: SpanKind.CLIENT
      }, activeContext)

      // Headers propagation
      const headers = {}
      // This line is important, otherwise it will use the old context
      const newCtx = api.trace.setSpan(activeContext, span)
      api.propagation.inject(newCtx, headers, {
        set (_carrier, key, value) {
          headers[key] = value
        },
      })
      req.headers = {
        ...req.headers,
        ...headers
      }

      // We pass the span directly to the next client hooks
      ctx.span = span
    })
  }

  const onClientResponse = (_req, res, ctx) => {
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
        'http.response.status_code': res.statusCode,
      })
      span.setStatus(spanStatus)
    } else {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'No response received',
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
    onClientResponse,
    onClientError
  }
}

module.exports = {
  createTelemetryThreadInterceptorHooks
}
