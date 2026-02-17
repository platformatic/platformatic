import { trace } from '@opentelemetry/api'
import { deepEqual, equal } from 'node:assert'
import { test } from 'node:test'
import { addPinoInstrumentation } from '../lib/logger.js'

const spanContext = {
  traceId: '5e994e8fb53b27c91dcd2fec22771d15',
  spanId: '166f3ab30f21800b',
  traceFlags: 1
}

function withMockedActiveSpan (fn) {
  const originalGetSpan = trace.getSpan

  trace.getSpan = () => ({
    spanContext: () => spanContext
  })

  try {
    return fn()
  } finally {
    trace.getSpan = originalGetSpan
  }
}

test('addPinoInstrumentation adds a standalone mixin with default keys', () => {
  const options = {}

  addPinoInstrumentation(options)

  const result = withMockedActiveSpan(() => options.mixin())

  deepEqual(result, {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
    trace_flags: '01'
  })
})

test('standalone mixin returns an empty object if there is no active span context', () => {
  const options = {}

  addPinoInstrumentation(options)

  deepEqual(options.mixin(), {})
})

test('addPinoInstrumentation combines with existing mixin and preserves arguments', () => {
  const options = {
    mixin (...args) {
      return {
        foo: 'bar',
        args
      }
    }
  }

  addPinoInstrumentation(options)

  const result = withMockedActiveSpan(() => options.mixin('a', 1, true))

  deepEqual(result, {
    foo: 'bar',
    args: ['a', 1, true],
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
    trace_flags: '01'
  })
})

test('addPinoInstrumentation supports overriding log keys', () => {
  const options = {}

  addPinoInstrumentation(options, {
    traceId: 'traceId',
    spanId: 'spanId',
    traceFlags: 'traceFlags'
  })

  const result = withMockedActiveSpan(() => options.mixin())

  deepEqual(result, {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: '01'
  })
})

test('custom log key overrides do not affect subsequent calls', () => {
  const optionsWithOverrides = {}
  addPinoInstrumentation(optionsWithOverrides, {
    traceId: 'traceId'
  })

  const defaultOptions = {}
  addPinoInstrumentation(defaultOptions)

  const result = withMockedActiveSpan(() => defaultOptions.mixin())

  equal(result.trace_id, spanContext.traceId)
})
