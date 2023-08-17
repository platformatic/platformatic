'use strict'

const fp = require('fastify-plugin')
const { SpanStatusCode, SpanKind } = require('@opentelemetry/api')
const { ConsoleSpanExporter, BatchSpanProcessor, SimpleSpanProcessor, InMemorySpanExporter } = require('@opentelemetry/sdk-trace-base')
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions')
const { Resource } = require('@opentelemetry/resources')
const { PlatformaticTracerProvider } = require('./platformatic-trace-provider')
const { PlatformaticContext } = require('./platformatic-context')
const { fastifyTextMapGetter, fastifyTextMapSetter } = require('./fastify-text-map')
const { formatParamUrl } = require('./utils')
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

const { name: moduleName, version: moduleVersion } = require('../package.json')

const extractPath = (request) => {
  // We must user RouterPath, because otherwise `/test/123` will be considered as
  // a different operation than `/test/321`. In case is not set (this should actually happen only for HTTP/404) we fallback to the path.
  const { routerPath, url } = request
  let path
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
      'url.scheme': protocol
    }
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

const setupProvider = (app, opts) => {
  const { serviceName, version } = opts
  let exporter = opts.exporter
  if (!exporter) {
    app.log.warn('No exporter configured, defaulting to console.')
    exporter = { type: 'console' }
  }
  app.log.info(`Setting up telemetry for service: ${serviceName}${version ? ' version: ' + version : ''} with exporter of type ${exporter.type}`)
  const provider = new PlatformaticTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: version
    })
  })

  // Exporter config:
  // https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_exporter_zipkin.ExporterConfig.html
  const exporterOptions = { ...exporter.options, serviceName }

  let exporterObj
  if (exporter.type === 'console') {
    exporterObj = new ConsoleSpanExporter(exporterOptions)
  } else if (exporter.type === 'otlp') {
    // We require here because this require (and only the require!) creates some issue with c8 on some mjs tests on other modules. Since we need an assignemet here, we don't use a switch.
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto')
    exporterObj = new OTLPTraceExporter(exporterOptions)
  } else if (exporter.type === 'zipkin') {
    const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin')
    exporterObj = new ZipkinExporter(exporterOptions)
  } else if (exporter.type === 'memory') {
    exporterObj = new InMemorySpanExporter()
  } else {
    app.log.warn(`Unknown exporter type: ${exporter.type}, defaulting to console.`)
    exporterObj = new ConsoleSpanExporter(exporterOptions)
  }

  // We use a SimpleSpanProcessor for the console/memory exporters and a BatchSpanProcessor for the others.
  const spanProcessor = ['memory', 'console'].includes(exporter.type) ? new SimpleSpanProcessor(exporterObj) : new BatchSpanProcessor(exporterObj)
  provider.addSpanProcessor(spanProcessor)
  const tracer = provider.getTracer(moduleName, moduleVersion)
  const propagator = provider.getPropagator()
  return { tracer, exporter: exporterObj, propagator, provider }
}

async function setupTelemetry (app, opts) {
  // const { serviceName, version } = opts
  const openTelemetryAPIs = setupProvider(app, opts)
  const { tracer, propagator, provider } = openTelemetryAPIs
  const skipOperations = opts.skip || []

  // expose the span as a request decorator
  app.decorateRequest('span')

  const startSpan = async (request) => {
    if (skipOperations.includes(`${request.method}${request.url}`)) {
      request.log.debug({ operation: `${request.method}${request.url}` }, 'Skipping telemetry')
      return
    }

    // We populate the context with the incoming request headers
    let context = propagator.extract(new PlatformaticContext(), request, fastifyTextMapGetter)

    const path = extractPath(request)
    const span = tracer.startSpan(
      formatSpanName(request, path),
      {},
      context
    )
    span.kind = SpanKind.SERVER
    // Next 2 lines are needed by W3CTraceContextPropagator
    context = context.setSpan(span)
    span.setAttributes(formatSpanAttributes.request(request, path))
    span.context = context
    request.span = span
  }

  const setErrorInSpan = async (request, reply, error) => {
    const span = request.span
    span.setAttributes(formatSpanAttributes.error(error))
  }

  const injectPropagationHeadersInReply = async (request, reply) => {
    if (request.span) {
      const context = request.span.context
      propagator.inject(context, reply, fastifyTextMapSetter)
    }
  }

  const endSpan = async (request, reply) => {
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

  app.addHook('onRequest', startSpan)
  app.addHook('onSend', injectPropagationHeadersInReply)
  app.addHook('onResponse', endSpan)
  app.addHook('onError', setErrorInSpan)
  app.addHook('onClose', async function () {
    await provider.shutdown()
  })

  //* Client APIs
  const getSpanPropagationHeaders = (span) => {
    const context = span.context
    const headers = {}
    propagator.inject(context, headers, {
      set (carrier, key, value) {
        headers[key] = value
      }
    })
    return headers
  }

  // If a context is passed, is used. Otherwise is a new one is created.
  // Note that in this case we don't set the span in request, as this is a client call.
  // So the client caller is responible of:
  // - setting the propagatorHeaders in the client request
  // - closing the span
  const startSpanClient = (url, method, ctx) => {
    let context = ctx || new PlatformaticContext()
    const urlObj = fastUri.parse(url)

    if (skipOperations.includes(`${method}${urlObj.path}`)) {
      app.log.debug({ operation: `${method}${urlObj.path}` }, 'Skipping telemetry')
      return
    }

    /* istanbul ignore next */
    method = method || ''
    const name = `${method} ${urlObj.scheme}://${urlObj.host}:${urlObj.port}${urlObj.path}`

    const span = tracer.startSpan(name, {}, context)
    span.kind = SpanKind.CLIENT

    /* istanbul ignore next */
    const attributes = url
      ? {
          'server.address': urlObj.host,
          'server.port': urlObj.port,
          'http.request.method': method,
          'url.full': url,
          'url.path': urlObj.path
        }
      : {}
    span.setAttributes(attributes)

    // Next 2 lines are needed by W3CTraceContextPropagator
    context = context.setSpan(span)
    span.context = context

    const telemetryHeaders = getSpanPropagationHeaders(span)
    return { span, telemetryHeaders }
  }

  const endSpanClient = (span, response) => {
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

  app.decorate('openTelemetry', {
    ...openTelemetryAPIs,
    startSpanClient,
    endSpanClient,
    setErrorInSpanClient
  })
}

module.exports = fp(setupTelemetry)
