'use strict'

const { context, SpanKind, trace } = require('@opentelemetry/api')
const { getTracerProvider, getMessaging } = require('@platformatic/globals')

function getTracer () {
  return getTracerProvider().getTracer('telemetry-messaging-fixture')
}

const messaging = getMessaging()
messaging.handle({
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
