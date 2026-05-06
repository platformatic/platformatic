import { diag } from '@opentelemetry/api'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchSpanProcessor, InMemorySpanExporter } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { deepStrictEqual, strictEqual } from 'node:assert'
import { Writable } from 'node:stream'
import { test } from 'node:test'
import pino from 'pino'
import { createPlatformaticDiagLogger, setupDiagLogger } from '../lib/diag-logger.js'

test('createPlatformaticDiagLogger forwards OpenTelemetry diagnostic logs to the platformatic logger', t => {
  const calls = []
  const logger = {
    child (bindings) {
      calls.push(['child', bindings])
      return this
    },
    error (...args) {
      calls.push(['error', args])
    },
    warn (...args) {
      calls.push(['warn', args])
    },
    info (...args) {
      calls.push(['info', args])
    },
    debug (...args) {
      calls.push(['debug', args])
    },
    trace (...args) {
      calls.push(['trace', args])
    }
  }

  const diagLogger = createPlatformaticDiagLogger(logger)
  diagLogger.error('error message')
  diagLogger.warn('warn message')
  diagLogger.info('info message')
  diagLogger.debug('debug message')
  diagLogger.verbose('verbose message')

  deepStrictEqual(calls, [
    ['child', { name: '@platformatic/telemetry/diag' }],
    ['error', ['error message']],
    ['warn', ['warn message']],
    ['info', ['info message']],
    ['debug', ['debug message']],
    ['trace', ['verbose message']]
  ])

  t.after(() => diag.disable())
})

test('setupDiagLogger configures the OpenTelemetry diagnostic logger using the platformatic logger level', t => {
  const calls = []
  const logger = {
    level: 'debug',
    child () {
      return this
    },
    error (...args) {
      calls.push(['error', args])
    },
    warn (...args) {
      calls.push(['warn', args])
    },
    info (...args) {
      calls.push(['info', args])
    },
    debug (...args) {
      calls.push(['debug', args])
    },
    trace (...args) {
      calls.push(['trace', args])
    }
  }

  const configured = setupDiagLogger({ diagLogger: true }, logger)
  strictEqual(configured, true)

  diag.debug('debug message')
  diag.info('info message')

  strictEqual(calls[0][0], 'debug')
  strictEqual(calls[0][1][0].startsWith('@opentelemetry/api: Registered a global for diag v1.9.'), true)
  deepStrictEqual(calls.slice(1), [
    ['debug', ['debug message']],
    ['info', ['info message']]
  ])

  t.after(() => diag.disable())
})

test('createPlatformaticDiagLogger preserves additional primitive OpenTelemetry diagnostic arguments with pino', async () => {
  const lines = []
  const stream = new Writable({
    write (chunk, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()))
      callback()
    }
  })
  const logger = pino({ level: 'trace' }, stream)

  const diagLogger = createPlatformaticDiagLogger(logger)
  diagLogger.warn('first', 'second', 42)

  strictEqual(lines[0].msg, 'first second 42')
})

test('createPlatformaticDiagLogger serializes object diagnostic details with pino', async () => {
  const lines = []
  const stream = new Writable({
    write (chunk, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()))
      callback()
    }
  })
  const logger = pino({ level: 'trace' }, stream)

  const diagLogger = createPlatformaticDiagLogger(logger)
  diagLogger.debug('caught hook error: ', new Error('boom'))

  strictEqual(lines[0].msg, 'caught hook error: ')
  strictEqual(lines[0].details[0].name, 'Error')
  strictEqual(lines[0].details[0].message, 'boom')
  strictEqual(typeof lines[0].details[0].stack, 'string')
})

test('createPlatformaticDiagLogger uses toJSON() for diagnostic details when available', async () => {
  const lines = []
  const stream = new Writable({
    write (chunk, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()))
      callback()
    }
  })
  const logger = pino({ level: 'trace' }, stream)

  class SpanLike {
    constructor (name) {
      this.name = name
      this.attributes = { hidden: true }
    }

    toJSON () {
      return {
        name: this.name,
        attributes: {
          visible: true
        }
      }
    }
  }

  const diagLogger = createPlatformaticDiagLogger(logger)
  diagLogger.debug('items to be sent', [new SpanLike('first')])

  strictEqual(lines[0].msg, 'items to be sent')
  deepStrictEqual(lines[0].details, [[{ name: 'first', attributes: { visible: true } }]])
})

test('createPlatformaticDiagLogger renders spans using the OpenTelemetry custom inspect payload', async () => {
  const lines = []
  const stream = new Writable({
    write (chunk, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()))
      callback()
    }
  })
  const logger = pino({ level: 'trace' }, stream)
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'test-service' }),
    spanProcessors: [new BatchSpanProcessor(new InMemorySpanExporter())]
  })
  const tracer = provider.getTracer('test-scope')
  const span = tracer.startSpan('hello')
  span.setAttribute('foo', 'bar')
  span.end()

  const diagLogger = createPlatformaticDiagLogger(logger)
  diagLogger.debug('items to be sent', [span])

  strictEqual(lines[0].msg, 'items to be sent')
  strictEqual(lines[0].details[0][0].name, 'hello')
  strictEqual(lines[0].details[0][0].spanContext.traceId, span.spanContext().traceId)
  strictEqual(lines[0].details[0][0].spanContext.spanId, span.spanContext().spanId)
  strictEqual(lines[0].details[0][0].ended, true)
  strictEqual(lines[0].details[0][0].attributes.foo, 'bar')
  strictEqual(lines[0].details[0][0].resource.attributes['service.name'], 'test-service')
  strictEqual(lines[0].details[0][0].instrumentationScope.name, 'test-scope')
  strictEqual('_spanContext' in lines[0].details[0][0], false)
  strictEqual('_spanProcessor' in lines[0].details[0][0], false)
  strictEqual('_performanceStartTime' in lines[0].details[0][0], false)
})

test('createPlatformaticDiagLogger renders tracer objects using OpenTelemetry custom inspect payloads', async () => {
  const lines = []
  const stream = new Writable({
    write (chunk, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()))
      callback()
    }
  })
  const logger = pino({ level: 'trace' }, stream)
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'test-service' }),
    spanProcessors: [new BatchSpanProcessor(new InMemorySpanExporter())]
  })
  const tracer = provider.getTracer('test-scope')

  const diagLogger = createPlatformaticDiagLogger(logger)
  diagLogger.debug('otel objects', provider, tracer)

  strictEqual(lines[0].msg, 'otel objects')
  strictEqual(lines[0].details[0].resource.attributes['service.name'], 'test-service')
  strictEqual(lines[0].details[0].tracers[0].startsWith('test-scope'), true)
  strictEqual(lines[0].details[0].spanProcessors[0], 'BatchSpanProcessor')
  strictEqual(lines[0].details[1].instrumentationScope.name, 'test-scope')
  strictEqual(lines[0].details[1].resource.attributes['service.name'], 'test-service')
  strictEqual(lines[0].details[1].spanLimits.attributeCountLimit, 128)
  strictEqual('_registeredSpanProcessors' in lines[0].details[0], false)
  strictEqual('_tracerProvider' in lines[0].details[1], false)
})
