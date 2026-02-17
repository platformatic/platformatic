import { context, isSpanContextValid, trace } from '@opentelemetry/api'

const defaultLogKeys = {
  traceId: 'trace_id',
  spanId: 'span_id',
  traceFlags: 'trace_flags'
}

function addAttributes (logKeys, base) {
  const spanContext = trace.getSpan(context.active())?.spanContext()

  if (!spanContext || !isSpanContextValid(spanContext)) {
    return
  }

  base[logKeys.traceId] = spanContext.traceId
  base[logKeys.spanId] = spanContext.spanId
  base[logKeys.traceFlags] = `0${spanContext.traceFlags.toString(16)}`
}

function pinoInstrumentationCombinedMixin (logKeys, original, ...args) {
  const result = original(...args)
  const spanContext = trace.getSpan(context.active())?.spanContext()

  if (spanContext && isSpanContextValid(spanContext)) {
    result[logKeys.traceId] = spanContext.traceId
    result[logKeys.spanId] = spanContext.spanId
    result[logKeys.traceFlags] = `0${spanContext.traceFlags.toString(16)}`
  }

  return result
}

function pinoInstrumentationStandaloneMixin (logKeys) {
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
  const logKeys = Object.assign({}, defaultLogKeys, overrides)

  options.mixin = options.mixin
    ? pinoInstrumentationCombinedMixin.bind(null, logKeys, options.mixin)
    : pinoInstrumentationStandaloneMixin.bind(null, logKeys)
}
