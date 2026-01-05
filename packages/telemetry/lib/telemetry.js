import { SpanKind } from '@opentelemetry/api'
import fp from 'fastify-plugin'
import { setupTelemetry } from './telemetry-config.js'

// Telemetry fastify plugin
async function telemetry (app, opts) {
  if (opts.enabled === false) {
    return
  }

  const {
    startSpan,
    endSpan,
    startHTTPSpanClient,
    endHTTPSpanClient,
    setErrorInSpanClient,
    shutdown,
    openTelemetryAPIs,
    fastifyOtelInstrumentation
  } = setupTelemetry(opts, app.log, true) // Pass true for isStandalone

  // Register @fastify/otel as a nested plugin to capture Fastify-specific telemetry
  // This must be registered early to instrument all routes and hooks
  await app.register(fastifyOtelInstrumentation.plugin())

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
