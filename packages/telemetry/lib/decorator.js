import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'

export function createOpenTelemetryDecorator (tracerProvider) {
  const startHTTPSpanClient = (url, method, parentSpanContext) => {
    // When using automatic instrumentation (UndiciInstrumentation), don't create manual CLIENT spans
    // The automatic instrumentation will handle span creation and propagation
    // This prevents duplicate CLIENT spans for the same HTTP request

    // However, we still need to return telemetryHeaders for trace propagation
    // Extract them from the active context instead of creating a new span
    const activeContext = context.active()
    const activeSpan = trace.getSpan(activeContext)
    const telemetryHeaders = {}
    propagation.inject(activeContext, telemetryHeaders)

    // DEBUG: Log context and headers
    try {
      const fs = require('node:fs')
      const spanContext = activeSpan?.spanContext()
      fs.appendFileSync('/tmp/decorator-debug.log', `[${new Date().toISOString()}] startHTTPSpanClient: ${method} ${url}\n`)
      fs.appendFileSync('/tmp/decorator-debug.log', `  activeSpan exists: ${!!activeSpan}\n`)
      if (spanContext) {
        fs.appendFileSync('/tmp/decorator-debug.log', `  activeSpan trace: ${spanContext.traceId}, span: ${spanContext.spanId}\n`)
      }
      fs.appendFileSync('/tmp/decorator-debug.log', `  telemetryHeaders: ${JSON.stringify(telemetryHeaders)}\n`)
    } catch (e) {}

    // Return null span - UndiciInstrumentation will create the actual span
    // The proxy code will just skip calling endHTTPSpanClient if span is null
    return { span: null, telemetryHeaders }
  }

  const endHTTPSpanClient = (span, { statusCode, headers }) => {
    if (!span) return

    const spanStatus = { code: SpanStatusCode.OK }
    if (statusCode >= 400) {
      spanStatus.code = SpanStatusCode.ERROR
    }

    span.setAttributes({
      'http.response.status_code': statusCode
    })

    // Handle HTTP cache attributes
    const httpCacheId = headers?.['x-plt-http-cache-id']
    const isCacheHit = headers?.age !== undefined
    if (httpCacheId) {
      span.setAttributes({
        'http.cache.id': httpCacheId,
        'http.cache.hit': isCacheHit.toString()
      })
    }

    span.setStatus(spanStatus)
    span.end()
  }

  return {
    startHTTPSpanClient,
    endHTTPSpanClient,
    SpanKind
  }
}
