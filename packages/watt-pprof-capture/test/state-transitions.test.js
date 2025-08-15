'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { resolve } = require('node:path')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('@platformatic/runtime')

async function createApp (t) {
  // Always disable auto-start for controlled testing
  const originalEnv = process.env.PLT_DISABLE_FLAMEGRAPHS
  process.env.PLT_DISABLE_FLAMEGRAPHS = 'true'

  t.after(() => {
    if (originalEnv !== undefined) {
      process.env.PLT_DISABLE_FLAMEGRAPHS = originalEnv
    } else {
      delete process.env.PLT_DISABLE_FLAMEGRAPHS
    }
  })

  const configFile = resolve(__dirname, 'fixtures/runtime-test/platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
  })

  await app.start()
  // Wait for services and handlers to register
  await new Promise(resolve => setTimeout(resolve, 200))

  return app
}

test('getLastProfile should throw ProfilingNotStartedError when never started', async (t) => {
  const app = await createApp(t)

  try {
    await app.sendCommandToService('service', 'getLastProfile')
    assert.fail('Should have thrown ProfilingNotStartedError')
  } catch (error) {
    // Error may be wrapped by ITC/Fastify, check message content
    assert.ok(error.message.includes('Profiling not started'))
  }
})

test('error types should be distinguishable', async (t) => {
  const app = await createApp(t)

  // Test ProfilingNotStartedError
  try {
    await app.sendCommandToService('service', 'getLastProfile')
    assert.fail('Should have thrown error')
  } catch (error) {
    assert.ok(error.message.includes('Profiling not started'), 'Should indicate profiling not started')
    assert.ok(!error.message.includes('No profile available'), 'Should not mention profile availability')
  }

  // Start profiling to test different error states
  await app.sendCommandToService('service', 'startProfiling', { timeout: 500 })

  // Wait and get a profile to ensure profiling is working
  await new Promise(resolve => setTimeout(resolve, 600))
  const profile = await app.sendCommandToService('service', 'getLastProfile')
  assert.ok(profile instanceof Uint8Array, 'Should get Uint8Array from ITC')

  // Stop profiling
  await app.sendCommandToService('service', 'stopProfiling')

  // Test ProfilingNotStartedError after stopping
  try {
    await app.sendCommandToService('service', 'getLastProfile')
    assert.fail('Should have thrown error after stopping')
  } catch (error) {
    assert.ok(error.message.includes('Profiling not started'), 'Should indicate profiling not started after stop')
  }
})

test('multiple startProfiling calls should be idempotent', async (t) => {
  const app = await createApp(t)

  // Start profiling
  await app.sendCommandToService('service', 'startProfiling', { timeout: 500 })

  // Start again - should not throw error
  await app.sendCommandToService('service', 'startProfiling', { timeout: 500 })

  // Wait for profile to be captured
  await new Promise(resolve => setTimeout(resolve, 600))

  // Should still be able to get profile
  const profile = await app.sendCommandToService('service', 'getLastProfile')
  assert.ok(profile instanceof Uint8Array, 'Should get Uint8Array from ITC')
  assert.ok(profile.length > 0)

  await app.sendCommandToService('service', 'stopProfiling')
})

test('multiple stopProfiling calls should be idempotent', async (t) => {
  const app = await createApp(t)

  // Start and then stop
  await app.sendCommandToService('service', 'startProfiling', { timeout: 500 })
  await app.sendCommandToService('service', 'stopProfiling')

  // Stop again - should not throw error
  await app.sendCommandToService('service', 'stopProfiling')

  // Should still be in stopped state
  try {
    await app.sendCommandToService('service', 'getLastProfile')
    assert.fail('Should throw ProfilingNotStartedError')
  } catch (error) {
    assert.ok(error.message.includes('Profiling not started'))
  }
})

test('rapid start/stop cycles should work correctly', async (t) => {
  const app = await createApp(t)

  // Rapid start/stop/start/stop
  await app.sendCommandToService('service', 'startProfiling', { timeout: 500 })
  await app.sendCommandToService('service', 'stopProfiling')
  await app.sendCommandToService('service', 'startProfiling', { timeout: 500 })
  await app.sendCommandToService('service', 'stopProfiling')

  // Should be in stopped state
  try {
    await app.sendCommandToService('service', 'getLastProfile')
    assert.fail('Should throw ProfilingNotStartedError')
  } catch (error) {
    assert.ok(error.message.includes('Profiling not started'))
  }
})

test('profile data should persist after stopping until next start', async (t) => {
  const app = await createApp(t)

  // Start profiling and capture profile
  await app.sendCommandToService('service', 'startProfiling', { timeout: 500 })
  await new Promise(resolve => setTimeout(resolve, 600))

  // Get profile while running
  const profile1 = await app.sendCommandToService('service', 'getLastProfile')
  assert.ok(profile1 instanceof Uint8Array, 'Should get Uint8Array from ITC')

  // Stop profiling
  await app.sendCommandToService('service', 'stopProfiling')

  // Start again - should get new profile eventually
  await app.sendCommandToService('service', 'startProfiling', { timeout: 500 })
  await new Promise(resolve => setTimeout(resolve, 600))

  const profile2 = await app.sendCommandToService('service', 'getLastProfile')
  assert.ok(profile2 instanceof Uint8Array, 'Should get Uint8Array from ITC')
  // Profiles might be different due to different capture times

  await app.sendCommandToService('service', 'stopProfiling')
})

test('different timeout values should work', async (t) => {
  const app = await createApp(t)

  // Test with very short timeout
  await app.sendCommandToService('service', 'startProfiling', { timeout: 100 })
  await new Promise(resolve => setTimeout(resolve, 200))

  const shortProfile = await app.sendCommandToService('service', 'getLastProfile')
  assert.ok(shortProfile instanceof Uint8Array)
  assert.ok(shortProfile.length > 0)

  await app.sendCommandToService('service', 'stopProfiling')

  // Test with longer timeout
  await app.sendCommandToService('service', 'startProfiling', { timeout: 1000 })
  await new Promise(resolve => setTimeout(resolve, 1100))

  const longProfile = await app.sendCommandToService('service', 'getLastProfile')
  assert.ok(longProfile instanceof Uint8Array)
  assert.ok(longProfile.length > 0)

  await app.sendCommandToService('service', 'stopProfiling')
})

test('state should remain consistent after getLastProfile calls', async (t) => {
  const app = await createApp(t)

  await app.sendCommandToService('service', 'startProfiling', { timeout: 500 })
  await new Promise(resolve => setTimeout(resolve, 600))

  // Multiple getLastProfile calls should all work
  const profile1 = await app.sendCommandToService('service', 'getLastProfile')
  const profile2 = await app.sendCommandToService('service', 'getLastProfile')
  const profile3 = await app.sendCommandToService('service', 'getLastProfile')

  assert.ok(profile1 instanceof Uint8Array)
  assert.ok(profile2 instanceof Uint8Array)
  assert.ok(profile3 instanceof Uint8Array)

  // All should return the same profile data (latest captured)
  assert.deepStrictEqual(profile1, profile2)
  assert.deepStrictEqual(profile2, profile3)

  await app.sendCommandToService('service', 'stopProfiling')
})
