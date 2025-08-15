'use strict'

const assert = require('node:assert')
const { test } = require('node:test')

test('pprof capture module should not auto-start when disabled', async (t) => {
  // Set environment to disable flamegraphs
  const originalEnv = process.env.PLT_DISABLE_FLAMEGRAPHS
  process.env.PLT_DISABLE_FLAMEGRAPHS = 'true'

  // Mock ITC to test actual behavior
  const mockHandlers = new Map()
  const mockITC = {
    handle: (name, handler) => {
      mockHandlers.set(name, handler)
    },
    _handlers: mockHandlers
  }

  const kITC = Symbol.for('plt.runtime.itc')
  globalThis[kITC] = mockITC

  t.after(() => {
    delete globalThis[kITC]
    process.env.PLT_DISABLE_FLAMEGRAPHS = originalEnv
    delete require.cache[require.resolve('../index.js')]
  })

  // Module should load but not auto-start capturing
  const capture = require('../index.js')
  assert.strictEqual(capture.isActive(), false, 'Should not auto-start when disabled')

  // Register handlers and test ITC behavior
  capture.registerHandler()
  const sendHandler = mockHandlers.get('sendFlamegraph')

  // Should throw because profiling not started
  try {
    await sendHandler({
      url: 'http://example.com/test',
      headers: { authorization: 'Bearer token' }
    })
    assert.fail('Expected ProfilingNotStartedError to be thrown')
  } catch (error) {
    assert.strictEqual(error.code, 'PLT_PPROF_PROFILING_NOT_STARTED')
    assert.ok(error.message.includes('Profiling not started'), 'Should indicate profiling not started')
  }
})

test('pprof capture module should auto-start when enabled', async (t) => {
  // Ensure flamegraphs are enabled
  const originalEnv = process.env.PLT_DISABLE_FLAMEGRAPHS
  const originalInterval = process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC

  delete process.env.PLT_DISABLE_FLAMEGRAPHS // Enable auto-start
  process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC = '1' // Short interval

  // Mock ITC to test actual behavior
  const mockHandlers = new Map()
  const mockITC = {
    handle: (name, handler) => {
      mockHandlers.set(name, handler)
    },
    _handlers: mockHandlers
  }

  const kITC = Symbol.for('plt.runtime.itc')
  globalThis[kITC] = mockITC

  t.after(() => {
    delete globalThis[kITC]
    if (originalEnv !== undefined) {
      process.env.PLT_DISABLE_FLAMEGRAPHS = originalEnv
    } else {
      delete process.env.PLT_DISABLE_FLAMEGRAPHS
    }
    if (originalInterval !== undefined) {
      process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC = originalInterval
    } else {
      delete process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC
    }
    delete require.cache[require.resolve('../index.js')]
  })

  // Module should load and auto-start capturing
  const capture = require('../index.js')
  assert.strictEqual(capture.isActive(), true, 'Should auto-start when enabled')

  t.after(() => {
    capture.stopCapture()
  })
})

test('ITC handlers should be registered', async (t) => {
  const originalEnv = process.env.PLT_DISABLE_FLAMEGRAPHS
  process.env.PLT_DISABLE_FLAMEGRAPHS = 'true' // Disable auto-start for test

  // Mock global ITC
  const mockHandlers = new Map()
  const mockITC = {
    handle: (name, handler) => {
      mockHandlers.set(name, handler)
    },
    _handlers: mockHandlers
  }

  const kITC = Symbol.for('plt.runtime.itc')
  globalThis[kITC] = mockITC

  t.after(() => {
    delete globalThis[kITC]
    delete require.cache[require.resolve('../index.js')]
    if (originalEnv !== undefined) {
      process.env.PLT_DISABLE_FLAMEGRAPHS = originalEnv
    } else {
      delete process.env.PLT_DISABLE_FLAMEGRAPHS
    }
  })

  const capture = require('../index.js')
  capture.registerHandler()

  // Check that handlers are registered
  assert.ok(mockHandlers.has('sendFlamegraph'))
})

test('sendFlamegraph handler should work correctly', async (t) => {
  const originalInterval = process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC
  const originalDisable = process.env.PLT_DISABLE_FLAMEGRAPHS
  process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC = '1' // Short timeout for tests
  process.env.PLT_DISABLE_FLAMEGRAPHS = 'true' // Disable auto-start

  // Mock ITC and setup
  const mockHandlers = new Map()
  const mockITC = {
    handle: (name, handler) => {
      mockHandlers.set(name, handler)
    },
    _handlers: mockHandlers
  }

  const kITC = Symbol.for('plt.runtime.itc')
  globalThis[kITC] = mockITC

  t.after(() => {
    delete globalThis[kITC]
    delete require.cache[require.resolve('../index.js')]
    if (originalInterval !== undefined) {
      process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC = originalInterval
    } else {
      delete process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC
    }
    if (originalDisable !== undefined) {
      process.env.PLT_DISABLE_FLAMEGRAPHS = originalDisable
    } else {
      delete process.env.PLT_DISABLE_FLAMEGRAPHS
    }
  })

  const capture = require('../index.js')

  // Start capturing so we can test the sendFlamegraph behavior
  capture.startCapture()
  capture.registerHandler()

  // Get the handler
  const sendHandler = mockHandlers.get('sendFlamegraph')

  // Test with no profile (profiling started but no profile captured yet)
  try {
    await sendHandler({
      url: 'http://example.com/success',
      headers: { authorization: 'Bearer token' }
    })
    assert.fail('Expected NoProfileAvailableError to be thrown')
  } catch (error) {
    assert.strictEqual(error.code, 'PLT_PPROF_NO_PROFILE_AVAILABLE')
    assert.ok(error.message.includes('No profile available'))
  }

  // Stop capturing and test different behavior
  capture.stopCapture()

  try {
    await sendHandler({
      url: 'http://example.com/test',
      headers: { authorization: 'Bearer token' }
    })
    assert.fail('Expected ProfilingNotStartedError to be thrown')
  } catch (error) {
    assert.strictEqual(error.code, 'PLT_PPROF_PROFILING_NOT_STARTED')
    assert.ok(error.message.includes('Profiling not started'))
  }
})

test('should handle environment variables correctly', async (t) => {
  const originalInterval = process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC
  const originalDisable = process.env.PLT_DISABLE_FLAMEGRAPHS

  process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC = '1' // Short timeout for tests
  delete process.env.PLT_DISABLE_FLAMEGRAPHS // Enable auto-start

  t.after(() => {
    if (originalInterval !== undefined) {
      process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC = originalInterval
    } else {
      delete process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC
    }
    if (originalDisable !== undefined) {
      process.env.PLT_DISABLE_FLAMEGRAPHS = originalDisable
    } else {
      delete process.env.PLT_DISABLE_FLAMEGRAPHS
    }
    delete require.cache[require.resolve('../index.js')]
  })

  // The module should auto-start with custom interval
  const capture = require('../index.js')
  assert.strictEqual(capture.isActive(), true, 'Should auto-start when environment allows')

  t.after(() => {
    capture.stopCapture()
  })
})

test('manual startCapture should work and enable ITC handlers', async (t) => {
  const originalEnv = process.env.PLT_DISABLE_FLAMEGRAPHS
  process.env.PLT_DISABLE_FLAMEGRAPHS = 'true' // Disable auto-start

  // Mock ITC to test actual behavior
  const mockHandlers = new Map()
  const mockITC = {
    handle: (name, handler) => {
      mockHandlers.set(name, handler)
    },
    _handlers: mockHandlers
  }

  const kITC = Symbol.for('plt.runtime.itc')
  globalThis[kITC] = mockITC

  t.after(() => {
    delete globalThis[kITC]
    process.env.PLT_DISABLE_FLAMEGRAPHS = originalEnv
    delete require.cache[require.resolve('../index.js')]
  })

  // Module should load but not auto-start
  const capture = require('../index.js')
  assert.strictEqual(capture.isActive(), false, 'Should not auto-start when disabled')

  // Manually start capture
  capture.startCapture()
  assert.strictEqual(capture.isActive(), true, 'Should be active after manual start')

  t.after(() => {
    capture.stopCapture()
  })

  // Register handlers and test that they now work
  capture.registerHandler()
  const sendHandler = mockHandlers.get('sendFlamegraph')

  // Should now throw "No profile available" instead of "Profiling not started"
  try {
    await sendHandler({
      url: 'http://example.com/test',
      headers: { authorization: 'Bearer token' }
    })
    assert.fail('Expected NoProfileAvailableError to be thrown')
  } catch (error) {
    assert.strictEqual(error.code, 'PLT_PPROF_NO_PROFILE_AVAILABLE')
    assert.ok(error.message.includes('No profile available'), 'Should indicate no profile available, not profiling not started')
  }
})

test('should throw MissingUrlError when URL is not provided', async (t) => {
  const originalEnv = process.env.PLT_DISABLE_FLAMEGRAPHS
  process.env.PLT_DISABLE_FLAMEGRAPHS = 'true' // Disable auto-start

  // Mock ITC to test actual behavior
  const mockHandlers = new Map()
  const mockITC = {
    handle: (name, handler) => {
      mockHandlers.set(name, handler)
    },
    _handlers: mockHandlers
  }

  const kITC = Symbol.for('plt.runtime.itc')
  globalThis[kITC] = mockITC

  t.after(() => {
    delete globalThis[kITC]
    process.env.PLT_DISABLE_FLAMEGRAPHS = originalEnv
    delete require.cache[require.resolve('../index.js')]
  })

  const capture = require('../index.js')

  // Start capturing and register handlers
  capture.startCapture()

  t.after(() => {
    capture.stopCapture()
  })

  capture.registerHandler()
  const sendHandler = mockHandlers.get('sendFlamegraph')

  // Should throw MissingUrlError when no URL provided
  try {
    await sendHandler({
      headers: { authorization: 'Bearer token' }
    })
    assert.fail('Expected MissingUrlError to be thrown')
  } catch (error) {
    assert.strictEqual(error.code, 'PLT_PPROF_MISSING_URL')
    assert.ok(error.message.includes('URL is required'))
  }
})
