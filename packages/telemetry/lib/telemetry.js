import { SpanKind } from '@opentelemetry/api'
import fp from 'fastify-plugin'
import { setupTelemetry } from './telemetry-config.js'

// Telemetry fastify plugin
async function telemetry (app, opts) {
  if (opts.enabled === false) {
    return
  }

  const {
    startHTTPSpan,
    endHTTPSpan,
    setErrorInSpan,
    startSpan,
    endSpan,
    startHTTPSpanClient,
    endHTTPSpanClient,
    setErrorInSpanClient,
    shutdown,
    openTelemetryAPIs
  } = setupTelemetry(opts, app.log)

  app.addHook('onRequest', startHTTPSpan)
  app.addHook('onResponse', endHTTPSpan)
  app.addHook('onError', setErrorInSpan)
  app.addHook('onClose', shutdown)

  app.decorate('openTelemetry', {
    ...openTelemetryAPIs,
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
