import { context, isSpanContextValid, trace } from '@opentelemetry/api'

const defaultLogKeys = {
  traceId: 'trace_id',
  spanId: 'span_id',
  traceFlags: 'trace_flags'
}

function pinoInstrumentationMixin (logKeys) {
  const spanContext = trace.getSpan(context.active())?.spanContext()

  if (!spanContext || !isSpanContextValid(spanContext)) {
    return {}
  }

  return {
    [logKeys.traceId]: spanContext.traceId,
    [logKeys.spanId]: spanContext.spanId,
    [logKeys.traceFlags]: `0${spanContext.traceFlags.toString(16)}`
  }
}

export function addPinoInstrumentation (options, overrides = {}) {
  const mixin = pinoInstrumentationMixin.bind(null, Object.assign(defaultLogKeys, overrides))

  if (options.mixin) {
    const originalMixin = options.mixin

    options.mixin = function combinedMixin (...args) {
      return Object.assign({}, originalMixin(...args), mixin(...args))
    }
  } else {
    options.mixin = mixin
  }
}
