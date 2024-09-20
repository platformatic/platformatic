'use strict'

const fp = require('fastify-plugin')
const { SpanStatusCode, SpanKind } = require('@opentelemetry/api')
const { PlatformaticContext } = require('./platformatic-context')
const {
  fastifyTextMapGetter,
  fastifyTextMapSetter,
} = require('./fastify-text-map')
const setup = require('./telemetry-config')
const { formatParamUrl } = require('@fastify/swagger')
const fastUri = require('fast-uri')

// Platformatic telemetry plugin.
// Supported Exporters:
// - console
// - otlp: (which also supports jaeger, see: https://opentelemetry.io/docs/instrumentation/js/exporters/#otlp-endpoint)
// - zipkin (https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-exporter-zipkin/README.md)
// - memory: for testing

// This has been partially copied and modified from @autotelic/opentelemetry: https://github.com/autotelic/fastify-opentelemetry/blob/main/index.js
// , according with [MIT license](https://github.com/autotelic/fastify-opentelemetry/blob/main/LICENSE.md):
// MIT License
// Copyright (c) 2020 autotelic
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
const extractPath = (request) => {
  // We must user RouterPath, because otherwise `/test/123` will be considered as
  // a different operation than `/test/321`. In case is not set (this should actually happen only for HTTP/404) we fallback to the path.
  const { routeOptions, url } = request
  let path
  const routerPath = routeOptions && routeOptions.url
  if (routerPath) {
    path = formatParamUrl(routerPath)
  } else {
    path = url
  }
  return path
}

function formatSpanName (request, path) {
  const { method } = request
  /* istanbul ignore next */
  return path ? `${method} ${path}` : method
}

const formatSpanAttributes = {
  request (request, path) {
    const { hostname, method, url, protocol } = request
    // Inspired by: https://github.com/fastify/fastify-url-data/blob/master/plugin.js#L11
    const urlData = fastUri.parse(`${protocol}://${hostname}${url}`)
    return {
      'server.address': hostname,
      'server.port': urlData.port,
      'http.request.method': method,
      'url.path': path,
      'url.scheme': protocol,
    }
  },
  reply (reply) {
    return {
      'http.response.status_code': reply.statusCode,
    }
  },
  error (error) {
    return {
      'error.name': error.name,
      'error.message': error.message,
      'error.stack': error.stack,
    }
  },
}

async function setupTelemetry (app, opts) {
  const openTelemetryAPIs = setup(opts, app.log)
  const { tracer, propagator, provider } = openTelemetryAPIs
  const skipOperations =
    opts?.skip?.map((skip) => {
      const { method, path } = skip
      return `${method}${path}`
    }) || []

  // expose the span as a request decorator
  app.decorateRequest('span')

  const startHTTPSpan = async (request) => {
    if (skipOperations.includes(`${request.method}${request.url}`)) {
      request.log.debug(
        { operation: `${request.method}${request.url}` },
        'Skipping telemetry'
      )
      return
    }

    // We populate the context with the incoming request headers
    let context = propagator.extract(
      new PlatformaticContext(),
      request,
      fastifyTextMapGetter
    )

    const path = extractPath(request)
    const span = tracer.startSpan(formatSpanName(request, path), {}, context)
    span.kind = SpanKind.SERVER
    // Next 2 lines are needed by W3CTraceContextPropagator
    context = context.setSpan(span)
    span.setAttributes(formatSpanAttributes.request(request, path))
    span.context = context
    request.span = span
  }

  const setErrorInSpan = async (request, _reply, error) => {
    const span = request.span
    span.setAttributes(formatSpanAttributes.error(error))
  }

  const injectPropagationHeadersInReply = async (request, reply) => {
    if (request.span) {
      const context = request.span.context
      propagator.inject(context, reply, fastifyTextMapSetter)
    }
  }

  const endHTTPSpan = async (request, reply) => {
    const span = request.span
    if (span) {
      const spanStatus = { code: SpanStatusCode.OK }
      if (reply.statusCode >= 400) {
        spanStatus.code = SpanStatusCode.ERROR
      }
      span.setAttributes(formatSpanAttributes.reply(reply))
      span.setStatus(spanStatus)
      span.end()
    }
  }

  app.addHook('onRequest', startHTTPSpan)
  app.addHook('onSend', injectPropagationHeadersInReply)
  app.addHook('onResponse', endHTTPSpan)
  app.addHook('onError', setErrorInSpan)
  app.addHook('onClose', async function () {
    try {
      await provider.shutdown()
    } catch (err) {
      app.log.error({ err }, 'Error shutting down telemetry provider')
    }
  })

  //* Client APIs
  const getSpanPropagationHeaders = (span) => {
    const context = span.context
    const headers = {}
    propagator.inject(context, headers, {
      set (_carrier, key, value) {
        headers[key] = value
      },
    })
    return headers
  }

  // If a context is passed, is used. Otherwise is a new one is created.
  // Note that in this case we don't set the span in request, as this is a client call.
  // So the client caller is responible of:
  // - setting the propagatorHeaders in the client request
  // - closing the span
  const startHTTPSpanClient = (url, method, ctx) => {
    let context = ctx || new PlatformaticContext()
    const urlObj = fastUri.parse(url)

    if (skipOperations.includes(`${method}${urlObj.path}`)) {
      app.log.debug(
        { operation: `${method}${urlObj.path}` },
        'Skipping telemetry'
      )
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

    const span = tracer.startSpan(name, {}, context)
    span.kind = SpanKind.CLIENT

    /* istanbul ignore next */
    const attributes = url
      ? {
          'server.address': urlObj.host,
          'server.port': urlObj.port,
          'http.request.method': method,
          'url.full': url,
          'url.path': urlObj.path,
          'url.scheme': urlObj.scheme,
        }
      : {}
    span.setAttributes(attributes)

    // Next 2 lines are needed by W3CTraceContextPropagator
    context = context.setSpan(span)
    span.context = context

    const telemetryHeaders = getSpanPropagationHeaders(span)
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
        'http.response.status_code': response.statusCode,
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

  const setErrorInSpanClient = (span, error) => {
    /* istanbul ignore next */
    if (!span) {
      return
    }
    span.setAttributes(formatSpanAttributes.error(error))
  }

  // In the generic "startSpan" the attributes here are specified by the caller
  const startSpan = (name, ctx, attributes = {}, kind = SpanKind.INTERNAL) => {
    const context = ctx || new PlatformaticContext()
    const span = tracer.startSpan(name, {}, context)
    span.kind = kind
    span.setAttributes(attributes)
    span.context = context
    return span
  }

  const endSpan = (span, error) => {
    /* istanbul ignore next */
    if (!span) {
      return
    }
    if (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      })
    } else {
      const spanStatus = { code: SpanStatusCode.OK }
      span.setStatus(spanStatus)
    }
    span.end()
  }

  app.decorate('openTelemetry', {
    ...openTelemetryAPIs,
    startHTTPSpanClient,
    endHTTPSpanClient,
    setErrorInSpanClient,
    startSpan,
    endSpan,
    SpanKind,
  })
}

module.exports = fp(setupTelemetry)
