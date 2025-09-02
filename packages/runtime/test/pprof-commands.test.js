'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime, Runtime } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')
const { getRuntimeLogsDir } = require('../lib/utils')
const { MissingPprofCapture } = require('../lib/errors')

test('should start profiling for a service', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Test starting profiling on a service
  const result = await app.startServiceProfiling('with-logger', { intervalMicros: 1000 })

  // Should not throw and complete successfully
  // The actual ITC handler in watt-pprof-capture will handle the profiling logic
  assert.ok(typeof result === 'undefined' || result === null, 'startServiceProfiling should not return a value')
})

test('should stop profiling for a service and return profile data', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Start profiling first
  await app.startServiceProfiling('with-logger', { intervalMicros: 1000 })

  // Wait a bit for some profile data to be collected
  await new Promise(resolve => setTimeout(resolve, 100))

  // Stop profiling and get the profile data
  const profileData = await app.stopServiceProfiling('with-logger')

  // Should return binary profile data (Buffer or Uint8Array)
  assert.ok(Buffer.isBuffer(profileData) || profileData instanceof Uint8Array, 'stopServiceProfiling should return a Buffer or Uint8Array')
  assert.ok(profileData.length > 0, 'Profile data should not be empty')
})

test('should throw error when starting profiling on non-existent service', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Try to start profiling on a service that doesn't exist
  await assert.rejects(
    () => app.startServiceProfiling('non-existent-service', {}),
    (err) => {
      assert.ok(err.message.includes('Service not found') || err.message.includes('non-existent-service'))
      return true
    },
    'Should throw error for non-existent service'
  )
})

test('should throw error when stopping profiling on non-existent service', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Try to stop profiling on a service that doesn't exist
  await assert.rejects(
    () => app.stopServiceProfiling('non-existent-service'),
    (err) => {
      assert.ok(err.message.includes('Service not found') || err.message.includes('non-existent-service'))
      return true
    },
    'Should throw error for non-existent service'
  )
})

test('should handle profiling already started error', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Start profiling
  await app.startServiceProfiling('with-logger', { intervalMicros: 1000 })

  // Try to start profiling again - should throw an error
  await assert.rejects(
    () => app.startServiceProfiling('with-logger', { intervalMicros: 1000 }),
    (err) => {
      // The error should indicate profiling is already started
      assert.ok(err.message.includes('already') || err.message.includes('started'))
      return true
    },
    'Should throw error when profiling is already started'
  )

  // Clean up - stop profiling
  await app.stopServiceProfiling('with-logger')
})

test('should handle profiling not started error', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Try to stop profiling when it's not started
  await assert.rejects(
    () => app.stopServiceProfiling('with-logger'),
    (err) => {
      // The error should indicate profiling is not started
      assert.ok(err.message.includes('not started') || err.message.includes('not running'))
      return true
    },
    'Should throw error when profiling is not started'
  )
})

test('runtime errors if watt-pprof-capture is not loaded', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const dirname = config.configManager.dirname
  assert.equal(config.configManager.current.preload.includes('@platformatic/watt-pprof-capture') || config.configManager.current.preload.some(p => p.includes('watt-pprof-capture')), true, 'pprof capture should be in preload')
  config.configManager.current.preload = [] // Remove pprof capture to simulate user error
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)
  const runtime = new Runtime(config.configManager, runtimeLogsDir, process.env)
  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()

  await runtime.start()

  await assert.rejects(runtime.startServiceProfiling('with-logger'), new MissingPprofCapture())
})

test('runtime errors if watt-pprof-capture is not loaded (stop)', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const dirname = config.configManager.dirname
  assert.equal(config.configManager.current.preload.includes('@platformatic/watt-pprof-capture') || config.configManager.current.preload.some(p => p.includes('watt-pprof-capture')), true, 'pprof capture should be in preload')
  config.configManager.current.preload = [] // Remove pprof capture to simulate user error
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)
  const runtime = new Runtime(config.configManager, runtimeLogsDir, process.env)
  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()

  await runtime.start()

  await assert.rejects(runtime.stopServiceProfiling('with-logger'), new MissingPprofCapture())
})
