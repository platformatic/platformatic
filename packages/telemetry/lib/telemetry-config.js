'use strict'

const { SpanStatusCode, SpanKind } = require('@opentelemetry/api')
const { PlatformaticContext } = require('./platformatic-context')
const {
  fastifyTextMapGetter,
  fastifyTextMapSetter,
} = require('./fastify-text-map')
const { formatParamUrl } = require('@fastify/swagger')
const fastUri = require('fast-uri')
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions')
const {
  ConsoleSpanExporter,
  BatchSpanProcessor,
  SimpleSpanProcessor,
  InMemorySpanExporter,
} = require('@opentelemetry/sdk-trace-base')

const FileSpanExporter = require('./file-span-exporter')

const { resourceFromAttributes } = require('@opentelemetry/resources')
const { PlatformaticTracerProvider } = require('./platformatic-trace-provider')

const { name: moduleName, version: moduleVersion } = require('../package.json')

// Platformatic telemetry plugin.
// Supported Exporters:
// - console
// - otlp: (which also supports jaeger, see: https://opentelemetry.io/docs/instrumentation/js/exporters/#otlp-endpoint)
// - zipkin (https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-exporter-zipkin/README.md)
// - memory: for testing

function formatSpanName (request, route) {
  if (route) {
    route = formatParamUrl(route)
  }

  const { method, url } = request
  return `${method} ${route ?? url}`
}

const formatSpanAttributes = {
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
      'url.scheme': protocol,
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

const initTelemetry = (opts, logger) => {
  const { applicationName, version } = opts
  let exporter = opts.exporter
  if (!exporter) {
    logger.warn('No exporter configured, defaulting to console.')
    exporter = { type: 'console' }
  }

  const exporters = Array.isArray(exporter) ? exporter : [exporter]

  logger.debug(
    `Setting up platformatic telemetry for application: ${applicationName}${version ? ' version: ' + version : ''} with exporter of type ${exporter.type}`
  )

  const provider = new PlatformaticTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: applicationName,
      [ATTR_SERVICE_VERSION]: version,
    }),
  })

  const exporterObjs = []
  const spanProcessors = []
  for (const exporter of exporters) {
    // Exporter config:
    // https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_exporter_zipkin.ExporterConfig.html
    const exporterOptions = { ...exporter.options, applicationName }

    let exporterObj
    if (exporter.type === 'console') {
      exporterObj = new ConsoleSpanExporter(exporterOptions)
    } else if (exporter.type === 'otlp') {
      // We require here because this require (and only the require!) creates some issue with c8 on some mjs tests on other modules. Since we need an assignemet here, we don't use a switch.
      const {
        OTLPTraceExporter,
      } = require('@opentelemetry/exporter-trace-otlp-proto')
      exporterObj = new OTLPTraceExporter(exporterOptions)
    } else if (exporter.type === 'zipkin') {
      const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin')
      exporterObj = new ZipkinExporter(exporterOptions)
    } else if (exporter.type === 'memory') {
      exporterObj = new InMemorySpanExporter()
    } else if (exporter.type === 'file') {
      exporterObj = new FileSpanExporter(exporterOptions)
    } else {
      logger.warn(
        `Unknown exporter type: ${exporter.type}, defaulting to console.`
      )
      exporterObj = new ConsoleSpanExporter(exporterOptions)
    }

    let spanProcessor
    // We use a SimpleSpanProcessor for the console/memory exporters and a BatchSpanProcessor for the others.
    // , unless "processor" is set to "simple" (used only in tests)
    if (exporter.processor === 'simple' || ['memory', 'console', 'file'].includes(exporter.type)) {
      spanProcessor = new SimpleSpanProcessor(exporterObj)
    } else {
      spanProcessor = new BatchSpanProcessor(exporterObj)
    }
    spanProcessors.push(spanProcessor)
    exporterObjs.push(exporterObj)
  }

  provider.addSpanProcessor(spanProcessors)
  const tracer = provider.getTracer(moduleName, moduleVersion)
  const propagator = provider.getPropagator()

  return { tracer, exporters: exporterObjs, propagator, provider, spanProcessors }
}

function setupTelemetry (opts, logger) {
  const openTelemetryAPIs = initTelemetry(opts, logger)
  const { tracer, propagator, provider } = openTelemetryAPIs
  const skipOperations =
    opts?.skip?.map((skip) => {
      const { method, path } = skip
      return `${method}${path}`
    }) || []

  const startHTTPSpan = async (request, reply) => {
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

    const route = request.routeOptions?.url ?? null
    const span = tracer.startSpan(formatSpanName(request, route), {}, context)
    span.kind = SpanKind.SERVER
    // Next 2 lines are needed by W3CTraceContextPropagator
    context = context.setSpan(span)
    span.setAttributes(formatSpanAttributes.request(request, route))
    span.context = context
    // Inject the propagation headers
    propagator.inject(context, reply, fastifyTextMapSetter)
    request.span = span
  }

  const setErrorInSpan = async (request, _reply, error) => {
    const span = request.span
    span.setAttributes(formatSpanAttributes.error(error))
  }

  const endHTTPSpan = async (request, reply) => {
    const span = request.span
    if (span) {
      propagator.inject(span.context, reply, fastifyTextMapSetter)
      const spanStatus = { code: SpanStatusCode.OK }
      if (reply.statusCode >= 400) {
        spanStatus.code = SpanStatusCode.ERROR
      }
      span.setAttributes(formatSpanAttributes.reply(reply))
      span.setStatus(spanStatus)
      span.end()
    }
  }

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
      logger.debug(
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

  // Unfortunately, this must be async, because of: https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_sdk_trace_base.SpanProcessor.html#shutdown
  const shutdown = async () => {
    try {
      await provider.shutdown()
    } catch (err) {
      logger.error({ err }, 'Error shutting down telemetry provider')
    }
  }

  return {
    startHTTPSpan,
    endHTTPSpan,
    setErrorInSpan,
    startHTTPSpanClient,
    endHTTPSpanClient,
    setErrorInSpanClient,
    startSpan,
    endSpan,
    shutdown,
    openTelemetryAPIs,
  }
}

module.exports = {
  setupTelemetry,
  formatSpanName,
  formatSpanAttributes
}
