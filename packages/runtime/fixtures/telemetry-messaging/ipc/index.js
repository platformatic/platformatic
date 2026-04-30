'use strict'

const { context, SpanKind, trace } = require('@opentelemetry/api')

function getTracer () {
  return globalThis.platformatic?.tracerProvider?.getTracer('telemetry-messaging-fixture')
}

globalThis.platformatic.messaging.handle({
  async reverse (value) {
    const activeSpan = trace.getSpan(context.active())
    const span = getTracer()?.startSpan('pure itc work', { kind: SpanKind.INTERNAL }, context.active())

    try {
      return {
        traceId: activeSpan?.spanContext()?.traceId,
        value: value.split('').reverse().join('')
      }
    } finally {
      span?.end()
    }
  },

  async fail () {
    throw new Error('Handler Kaboom!')
  }
})
