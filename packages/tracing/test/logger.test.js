import { trace } from '@opentelemetry/api'
import { equal, ok } from 'node:assert'
import { Writable } from 'node:stream'
import { test } from 'node:test'
import pino from 'pino'
import { addPinoInstrumentation } from '../lib/logger.js'

const spanContext = {
  traceId: '5e994e8fb53b27c91dcd2fec22771d15',
  spanId: '166f3ab30f21800b',
  traceFlags: 1
}

class MemoryStream extends Writable {
  constructor () {
    super()
    this.lines = []
  }

  _write (chunk, _, callback) {
    this.lines.push(chunk.toString())
    callback()
  }
}

function createLogger (options) {
  const stream = new MemoryStream()
  const logger = pino(
    {
      base: null,
      timestamp: false,
      ...options
    },
    stream
  )

  return { logger, stream }
}

function getLastLog (stream) {
  return JSON.parse(stream.lines[stream.lines.length - 1])
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

test('addPinoInstrumentation works with pino standalone mixin', () => {
  const options = {}
  addPinoInstrumentation(options)

  const { logger, stream } = createLogger(options)

  withMockedActiveSpan(() => {
    logger.info({ foo: 'bar' }, 'hello')
  })

  const log = getLastLog(stream)
  equal(log.foo, 'bar')
  equal(log.trace_id, spanContext.traceId)
  equal(log.span_id, spanContext.spanId)
  equal(log.trace_flags, '01')
})

test('addPinoInstrumentation works with pino combined mixin', () => {
  let mixinCalled = 0
  const options = {
    mixin () {
      mixinCalled++
      return { fromMixin: true }
    }
  }

  addPinoInstrumentation(options)

  const { logger, stream } = createLogger(options)

  withMockedActiveSpan(() => {
    logger.info({ foo: 'bar' }, 'hello')
  })

  const log = getLastLog(stream)
  equal(mixinCalled, 1)
  equal(log.foo, 'bar')
  equal(log.fromMixin, true)
  equal(log.trace_id, spanContext.traceId)
  equal(log.span_id, spanContext.spanId)
  equal(log.trace_flags, '01')
})

test('addPinoInstrumentation works with pino and custom keys', () => {
  const options = {}
  addPinoInstrumentation(options, {
    traceId: 'traceId',
    spanId: 'spanId',
    traceFlags: 'traceFlags'
  })

  const { logger, stream } = createLogger(options)

  withMockedActiveSpan(() => {
    logger.info('hello')
  })

  const log = getLastLog(stream)
  equal(log.traceId, spanContext.traceId)
  equal(log.spanId, spanContext.spanId)
  equal(log.traceFlags, '01')
})

test('standalone mixin does not add fields if no active span context', () => {
  const options = {}
  addPinoInstrumentation(options)

  const { logger, stream } = createLogger(options)

  logger.info('hello')

  const log = getLastLog(stream)
  ok(log.trace_id === undefined)
  ok(log.span_id === undefined)
  ok(log.trace_flags === undefined)
})
