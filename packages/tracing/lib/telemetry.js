import { SpanKind } from '@opentelemetry/api'
import fp from 'fastify-plugin'
import { setupTelemetry } from './telemetry-config.js'

// Telemetry fastify plugin
async function telemetry (app, opts) {
  if (opts.enabled === false) {
    return
  }

  const {
    instrumentation,
    getRequestContext,
    getSpanPropagationHeaders,
    startSpan,
    endSpan,
    startHTTPSpanClient,
    endHTTPSpanClient,
    setErrorInSpanClient,
    shutdown,
    openTelemetryAPIs
  } = await setupTelemetry(opts, app.log)

  await app.register(instrumentation.plugin())

  // The server span has always been exposed as request.span, keep it for the existing applications.
  app.decorateRequest('span', null)

  app.addHook('onRequest', async (request, reply) => {
    const { span, context } = request.opentelemetry()

    if (span) {
      request.span = span

      // Return the trace context to the caller, which can then correlate the response with the trace.
      reply.headers(getSpanPropagationHeaders(span, context))
    }
  })

  app.addHook('onClose', shutdown)

  app.decorate('openTelemetry', {
    ...openTelemetryAPIs,
    getRequestContext,
    startHTTPSpanClient,
    endHTTPSpanClient,
    setErrorInSpanClient,
    startSpan,
    endSpan,
    shutdown,
    SpanKind
  })
}

export default fp(telemetry)
