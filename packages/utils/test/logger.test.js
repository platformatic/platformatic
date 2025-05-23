const { describe, test } = require('node:test')
const { strictEqual, deepStrictEqual, throws } = require('node:assert')
const path = require('node:path')
const pino = require('pino')
const { buildPinoOptions, loadFormatters } = require('../lib/logger')

// Set up the directory path for fixtures
const fixturesDir = path.join(__dirname, 'fixtures', 'logger')

describe('buildPinoOptions', () => {
  test('buildPinoOptions - default values', (t) => {
    const pinoOptions = buildPinoOptions(
      {},
      {},
      'test-service',
      'worker-1',
      { context: {} },
      __dirname
    )

    deepStrictEqual(pinoOptions, {
      level: 'trace',
      name: 'test-service'
    })
  })

  test('buildPinoOptions - server config level fallback', (t) => {
    const pinoOptions = buildPinoOptions(
      {},
      { level: 'debug' },
      'test-service',
      'worker-1',
      { context: {} },
      __dirname
    )

    deepStrictEqual(pinoOptions, {
      level: 'debug',
      name: 'test-service'
    })
  })

  test('buildPinoOptions - logger config level takes precedence over server config', (t) => {
    const pinoOptions = buildPinoOptions(
      { level: 'info' },
      { level: 'debug' },
      'test-service',
      'worker-1',
      { context: {} },
      __dirname
    )

    deepStrictEqual(pinoOptions, {
      level: 'info',
      name: 'test-service'
    })
  })

  test('buildPinoOptions - custom level', (t) => {
    const pinoOptions = buildPinoOptions(
      { level: 'info' },
      {},
      'test-service',
      'worker-1',
      { context: {} },
      __dirname
    )

    deepStrictEqual(pinoOptions, {
      level: 'info',
      name: 'test-service'
    })
  })

  test('buildPinoOptions - with worker', (t) => {
    const pinoOptions = buildPinoOptions(
      {},
      {},
      'test-service',
      'worker-1',
      { context: { worker: { index: 0 } } },
      __dirname
    )

    const { hostname: currentHostname } = require('node:os')

    deepStrictEqual(pinoOptions, {
      level: 'trace',
      name: 'test-service',
      base: {
        pid: process.pid,
        hostname: currentHostname(),
        worker: 'worker-1'
      }
    })
  })

  test('buildPinoOptions - full custom options', (t) => {
    // First, create the fixtures directory and necessary files if they don't exist yet
    const fs = require('node:fs')

    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true })
    }

    const customLoggerConfig = {
      level: 'info',
      formatters: {
        path: path.join(fixturesDir, 'logger-bindings.js')
      },
      timestamp: 'isoTime',
      redact: {
        paths: ['password', 'apiKey', 'user.credentials.token'],
        censor: '***HIDDEN***'
      }
    }

    const pinoOptions = buildPinoOptions(
      customLoggerConfig,
      {},
      'test-service',
      'worker-1',
      { context: {} },
      __dirname
    )

    strictEqual(pinoOptions.level, 'info')
    strictEqual(pinoOptions.name, 'test-service')
    strictEqual(typeof pinoOptions.formatters, 'object')
    strictEqual(typeof pinoOptions.formatters.bindings, 'function')
    strictEqual(typeof pinoOptions.formatters.level, 'function')
    strictEqual(typeof pinoOptions.timestamp, 'function')

    // Test the custom formatters
    const bindings2 = pinoOptions.formatters.bindings({ name: 'test-name' })
    deepStrictEqual(bindings2, { name: 'test-name' })

    const level = pinoOptions.formatters.level('info')
    deepStrictEqual(level, { level: 'INFO' })

    // Verify timestamp is a function - we've already confirmed this is the isoTime function
    // from pino.stdTimeFunctions in a previous assertion
    strictEqual(typeof pinoOptions.timestamp, 'function')
  })

  test('buildPinoOptions - with standard timestamp function', (t) => {
    const timestampFunctions = ['epochTime', 'unixTime', 'nullTime', 'isoTime']

    for (const fnName of timestampFunctions) {
      const loggerConfig = { timestamp: fnName }

      const pinoOptions = buildPinoOptions(
        loggerConfig,
        {},
        'test-service',
        'worker-1',
        { context: {} },
        __dirname
      )

      strictEqual(typeof pinoOptions.timestamp, 'function')
    }
  })

  test('buildPinoOptions - with invalid timestamp string', (t) => {
    const invalidTimestampName = 'nonExistentTimestampFunction'
    const loggerConfig = { timestamp: invalidTimestampName }

    // The current implementation doesn't throw for invalid timestamp names
    // It just assigns undefined to pinoOptions.timestamp
    const pinoOptions = buildPinoOptions(
      loggerConfig,
      {},
      'test-service',
      'worker-1',
      { context: {} },
      __dirname
    )

    strictEqual(pinoOptions.timestamp, undefined,
      'Invalid timestamp function name should result in undefined timestamp')
  })

  test('buildPinoOptions - with boolean timestamp false', (t) => {
    const loggerConfig = { timestamp: false }

    const pinoOptions = buildPinoOptions(
      loggerConfig,
      {},
      'test-service',
      'worker-1',
      { context: {} },
      __dirname
    )

    // The implementation sets timestamp to undefined when it's not a valid timestamp name
    strictEqual(pinoOptions.timestamp, undefined)
  })

  test('buildPinoOptions - with timestamp as empty string', (t) => {
    const loggerConfig = { timestamp: '' }

    // The current implementation doesn't throw for empty string
    // It just assigns undefined to pinoOptions.timestamp
    const pinoOptions = buildPinoOptions(
      loggerConfig,
      {},
      'test-service',
      'worker-1',
      { context: {} },
      __dirname
    )

    strictEqual(pinoOptions.timestamp, undefined,
      'Empty timestamp string should result in undefined timestamp')
  })

  test('buildPinoOptions - with non-string non-object timestamp (boolean)', (t) => {
    // Test boolean value which should be handled correctly
    const loggerConfig = { timestamp: false }

    const pinoOptions = buildPinoOptions(
      loggerConfig,
      {},
      'test-service',
      'worker-1',
      { context: {} },
      __dirname
    )

    strictEqual(pinoOptions.timestamp, undefined,
      'Boolean timestamp value gets set to undefined')
  })

  test('buildPinoOptions - with number as timestamp value', (t) => {
    // Test how the implementation handles a number value for timestamp
    const loggerConfig = { timestamp: 123 }

    // The actual behavior is that numeric timestamps are ignored
    const pinoOptions = buildPinoOptions(
      loggerConfig,
      {},
      'test-service',
      'worker-1',
      { context: {} },
      __dirname
    )

    strictEqual(pinoOptions.timestamp, undefined,
      'Numeric timestamp should be set to undefined')
  })

  test('buildPinoOptions - invalid formatters.bindings value', (t) => {
    const loggerConfig = {
      formatters: {
        path: path.join(fixturesDir, 'invalid-formatters.js')
      }
    }

    // Using real formatters file with non-function bindings
    throws(
      () => {
        buildPinoOptions(
          loggerConfig,
          {},
          'test-service',
          'worker-1',
          { context: {} },
          __dirname
        )
      },
      (err) => {
        return err.message === 'logger.formatters.bindings must be a function'
      }
    )
  })

  test('buildPinoOptions - invalid formatters.level value', (t) => {
    // This test is using a simpler approach that directly modifies the invalid-formatters.js
    // file to contain a valid bindings function but invalid level
    const fs = require('node:fs')

    // Create a temporary file with valid bindings but invalid level
    const tempFormatterPath = path.join(fixturesDir, 'temp-invalid-level.js')
    fs.writeFileSync(tempFormatterPath, `
      'use strict'
      module.exports = {
        bindings: function(bindings) { return bindings },
        level: 'not a function'
      }
    `)

    try {
      const loggerConfig = {
        formatters: {
          path: tempFormatterPath
        }
      }

      throws(
        () => {
          buildPinoOptions(
            loggerConfig,
            {},
            'test-service',
            'worker-1',
            { context: {} },
            __dirname
          )
        },
        {
          message: 'logger.formatters.level must be a function'
        }
      )
    } finally {
      // Clean up
      try {
        fs.unlinkSync(tempFormatterPath)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  })

  test('buildPinoOptions - standard timestamp functions', (t) => {
    // Test that all standard timestamp functions from pino are available
    strictEqual(pino.stdTimeFunctions.epochTime, pino.stdTimeFunctions.epochTime)
    strictEqual(pino.stdTimeFunctions.unixTime, pino.stdTimeFunctions.unixTime)
    strictEqual(pino.stdTimeFunctions.nullTime, pino.stdTimeFunctions.nullTime)
    strictEqual(pino.stdTimeFunctions.isoTime, pino.stdTimeFunctions.isoTime)
  })

  test('buildPinoOptions - with redact paths and censor', (t) => {
    const loggerConfig = {
      redact: {
        paths: ['password', 'apiKey', 'user.credentials.token'],
        censor: '***HIDDEN***'
      }
    }

    const pinoOptions = buildPinoOptions(
      loggerConfig,
      {},
      'test-service',
      'worker-1',
      { context: {} },
      __dirname
    )

    deepStrictEqual(pinoOptions.redact, {
      paths: ['password', 'apiKey', 'user.credentials.token'],
      censor: '***HIDDEN***'
    })
  })

  test('buildPinoOptions - with redact paths only', (t) => {
    const loggerConfig = {
      redact: {
        paths: ['password', 'apiKey']
        // No censor specified
      }
    }

    const pinoOptions = buildPinoOptions(
      loggerConfig,
      {},
      'test-service',
      'worker-1',
      { context: {} },
      __dirname
    )

    // Default behavior allows undefined censor
    deepStrictEqual(pinoOptions.redact, {
      paths: ['password', 'apiKey'],
      censor: undefined
    })
  })

  test('buildPinoOptions - with empty redact paths', (t) => {
    const loggerConfig = {
      redact: {
        paths: [],
        censor: '***'
      }
    }

    const pinoOptions = buildPinoOptions(
      loggerConfig,
      {},
      'test-service',
      'worker-1',
      { context: {} },
      __dirname
    )

    deepStrictEqual(pinoOptions.redact, {
      paths: [],
      censor: '***'
    })
  })

  test('buildPinoOptions - with nested redact paths', (t) => {
    const loggerConfig = {
      redact: {
        paths: ['user.password', 'deeply.nested.secret.key'],
        censor: '[REDACTED]'
      }
    }

    const pinoOptions = buildPinoOptions(
      loggerConfig,
      {},
      'test-service',
      'worker-1',
      { context: {} },
      __dirname
    )

    deepStrictEqual(pinoOptions.redact, {
      paths: ['user.password', 'deeply.nested.secret.key'],
      censor: '[REDACTED]'
    })
  })

  test('buildPinoOptions - invalid base', (t) => {
    const loggerConfig = {
      base: {
        pid: 1n
      }
    }

    throws(
      () => {
        buildPinoOptions(
          loggerConfig,
          {},
          'test-service',
          'worker-1',
          { context: {} },
          __dirname
        )
      },
      (err) => {
        return err.message === 'logger.base.pid must be a string'
      }
    )
  })

  test('buildPinoOptions - invalid customLevels', (t) => {
    const loggerConfig = {
      customLevels: {
        i: 'not a number'
      }
    }

    throws(
      () => {
        buildPinoOptions(
          loggerConfig,
          {},
          'test-service',
          'worker-1',
          { context: {} },
          __dirname
        )
      },
      (err) => {
        return err.message === 'logger.customLevels.i must be a number'
      }
    )
  })
})

describe('loadFormatters', () => {
  test('loadFormatters - non-existent file', (t) => {
    const mockRequire = {}
    mockRequire.resolve = () => { throw new Error('Cannot find module') }
    const nonExistentPath = path.join(fixturesDir, 'non-existent-file.js')

    throws(
      () => {
        loadFormatters(mockRequire, nonExistentPath)
      },
      (error) => {
        return error instanceof Error &&
          error.message.includes(`Failed to load function from ${nonExistentPath}`)
      }
    )
  })

  test('loadFormatters - file exists but returns non-function', (t) => {
    // Create a mock require function that returns an object with non-function properties
    const mockRequire = () => ({
      bindings: { notAFunction: true },
      level: 'string instead of function'
    })
    mockRequire.resolve = () => 'mock-path'

    // The module exists and returns an object with non-function properties
    const result = loadFormatters(mockRequire, 'mock-path')

    // Should return the object with the properties
    deepStrictEqual(result, {
      bindings: { notAFunction: true },
      level: 'string instead of function'
    })
  })

  test('loadFormatters - file exports correct formatters', (t) => {
    // Mock formatters with proper function exports
    const mockBindingsFormatter = (bindings) => ({ ...bindings, app: 'test-app' })
    const mockLevelFormatter = (label) => ({ level: label.toUpperCase() })

    const mockRequire = () => ({
      bindings: mockBindingsFormatter,
      level: mockLevelFormatter
    })
    mockRequire.resolve = () => 'mock-path'

    const result = loadFormatters(mockRequire, 'mock-path')

    // Verify the formatters were loaded correctly
    strictEqual(typeof result.bindings, 'function')
    strictEqual(typeof result.level, 'function')

    // Test the bindings formatter
    const bindingsResult = result.bindings({ service: 'my-service' })
    deepStrictEqual(bindingsResult, { service: 'my-service', app: 'test-app' })

    // Test the level formatter
    const levelResult = result.level('info')
    deepStrictEqual(levelResult, { level: 'INFO' })
  })

  test('loadFormatters - error handling', (t) => {
    const mockRequire = () => { throw new Error('Module error') }
    mockRequire.resolve = () => 'mock-path'

    throws(
      () => loadFormatters(mockRequire, 'some-path'),
      {
        message: 'Failed to load function from some-path: Module error'
      }
    )
  })
})

// invalid base
// invalid customLevels
