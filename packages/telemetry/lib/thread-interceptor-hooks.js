'use strict'

const { SpanStatusCode, SpanKind } = require('@opentelemetry/api')
const { formatSpanName, formatSpanAttributes, extractPath } = require('./telemetry-config')
const api = require('@opentelemetry/api')
const fastUri = require('fast-uri')

const tracer = api.trace.getTracer('thread-interceptor-hooks', '0.1.0')

const createTelemetryThreadInterceptorHooks = () => {
  const onServerRequest = (req, cb) => {
    const activeContext = api.propagation.extract(api.context.active(), req.headers)

    const path = extractPath(req)
    const span = tracer.startSpan(formatSpanName(req, path), {
      attributes: formatSpanAttributes.request(req, path),
      kind: SpanKind.SERVER
    }, activeContext)
    const ctx = api.trace.setSpan(activeContext, span)

    api.context.with(ctx, cb)
  }

  const onServerResponse = (req, _res) => {
    const activeContext = api.context.active()
    const span = api.trace.getSpan(activeContext)
    if (span) {
      span.end()
    }
  }

  const onServerError = (_req, res, error) => {
    const activeContext = api.context.active()
    const span = api.trace.getSpan(activeContext)
    if (span) {
      span.setAttributes(formatSpanAttributes.error(error))
    }
  }

  const onClientRequest = (req, ctx) => {
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

    ctx.span = span
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
