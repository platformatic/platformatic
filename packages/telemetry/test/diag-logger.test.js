import { diag } from '@opentelemetry/api'
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

test('createPlatformaticDiagLogger preserves additional OpenTelemetry diagnostic arguments with pino', async () => {
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
  diagLogger.debug('caught hook error: ', new Error('boom'))

  strictEqual(lines[0].msg, 'first second 42')
  strictEqual(lines[1].msg.includes('caught hook error:'), true)
  strictEqual(lines[1].msg.includes('Error: boom'), true)
})
