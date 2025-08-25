'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { resolve } = require('node:path')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('@platformatic/runtime')

test('watt-pprof-capture ITC handlers should work correctly', async (t) => {
  // Disable auto-start to control profiling manually
  const originalEnv = process.env.PLT_DISABLE_FLAMEGRAPHS
  process.env.PLT_DISABLE_FLAMEGRAPHS = 'true'

  t.after(() => {
    if (originalEnv !== undefined) {
      process.env.PLT_DISABLE_FLAMEGRAPHS = originalEnv
    } else {
      delete process.env.PLT_DISABLE_FLAMEGRAPHS
    }
  })

  // Load the runtime configuration
  const configFile = resolve(__dirname, 'fixtures/runtime-test/platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
  })

  const url = await app.start()

  // Wait a bit for services to start and handlers to register
  await new Promise(resolve => setTimeout(resolve, 200))

  // Test that the hello world service is working (verifying preload didn't break anything)
  const res = await request(`${url}/`)
  const json = await res.body.json()

  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(json.message, 'Hello World')

  // Test health endpoint
  const healthRes = await request(`${url}/health`)
  const healthJson = await healthRes.body.json()

  assert.strictEqual(healthRes.statusCode, 200)
  assert.strictEqual(healthJson.status, 'ok')

  // Test ITC functionality
  // 1. Test getLastProfile when profiling not started (should throw error)
  try {
    await app.sendCommandToService('service', 'getLastProfile')
    assert.fail('Should have thrown an error when profiling not started')
  } catch (error) {
    assert.ok(error.message.includes('Profiling not started') || error.message.includes('profiling not started'))
  }

  // 2. Start profiling with a very short timeout for testing
  await app.sendCommandToService('service', 'startProfiling', { timeout: 500 })

  // 3. Wait for the profile to be captured
  await new Promise(resolve => setTimeout(resolve, 600))

  // 4. Get the profile (should succeed now)
  const profile = await app.sendCommandToService('service', 'getLastProfile')
  assert.ok(profile instanceof Uint8Array, 'Profile should be Uint8Array from ITC')
  assert.ok(profile.length > 0, 'Profile should have content')

  // 5. Test stopping profiling
  await app.sendCommandToService('service', 'stopProfiling')

  // 6. Test getLastProfile after stopping (should throw error)
  try {
    await app.sendCommandToService('service', 'getLastProfile')
    assert.fail('Should have thrown an error when profiling stopped')
  } catch (error) {
    assert.ok(error.message.includes('Profiling not started') || error.message.includes('profiling not started'))
  }
})

test('watt-pprof-capture should handle disabled auto-start correctly', async (t) => {
  // Test with auto-start disabled
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

  const url = await app.start()

  // Wait for services to start
  await new Promise(resolve => setTimeout(resolve, 200))

  // Verify that the service is still working with preload disabled
  const res = await request(`${url}/health`)
  const json = await res.body.json()

  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(json.status, 'ok')

  // Test that getLastProfile throws correct error when auto-start disabled
  try {
    await app.sendCommandToService('service', 'getLastProfile')
    assert.fail('Should have thrown an error when profiling not started')
  } catch (error) {
    assert.ok(error.message.includes('Profiling not started') || error.message.includes('profiling not started'))
  }

  // Test manual start after auto-start was disabled
  await app.sendCommandToService('service', 'startProfiling', { timeout: 500 })

  // Should be able to get profile after manual start (or get "no profile available" which is different from "not started")
  try {
    const profile = await app.sendCommandToService('service', 'getLastProfile')
    assert.ok(profile instanceof Uint8Array, 'Profile should be Uint8Array from ITC')
  } catch (error) {
    // If no profile yet, should be "no profile available", not "not started"
    assert.ok(!error.message.includes('Profiling not started'), 'Should not indicate profiling not started after manual start')
    assert.ok(error.message.includes('No profile available'), 'Should indicate no profile available')
  }

  // Clean up
  await app.sendCommandToService('service', 'stopProfiling')
})

test('watt-pprof-capture should auto-start when enabled', async (t) => {
  // Test with auto-start enabled
  const originalEnv = process.env.PLT_DISABLE_FLAMEGRAPHS
  const originalInterval = process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC

  delete process.env.PLT_DISABLE_FLAMEGRAPHS // Enable auto-start
  process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC = '1' // Short interval for testing

  t.after(() => {
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
  })

  const configFile = resolve(__dirname, 'fixtures/runtime-test/platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  // Wait for auto-start profiling to begin and capture first profile
  await new Promise(resolve => setTimeout(resolve, 1200))

  // Test that we can get a profile (auto-start should have started profiling)
  try {
    const profile = await app.sendCommandToService('service', 'getLastProfile')
    assert.ok(profile instanceof Uint8Array, 'Should return Uint8Array from ITC')
    assert.ok(profile.length > 0, 'Profile should have content')
  } catch (error) {
    // It's ok if no profile is available yet, but it shouldn't be "not started"
    assert.ok(!error.message.includes('Profiling not started'), 'Should not indicate profiling not started when auto-start enabled')
  }

  // Clean up
  await app.sendCommandToService('service', 'stopProfiling')
})

test('watt-pprof-capture should generate a profile', async (t) => {
  // Test with auto-start enabled
  const originalEnv = process.env.PLT_DISABLE_FLAMEGRAPHS
  const originalInterval = process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC

  delete process.env.PLT_DISABLE_FLAMEGRAPHS // Enable auto-start
  process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC = '1' // Short interval for testing

  t.after(() => {
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
  })

  const configFile = resolve(__dirname, 'fixtures/runtime-test/platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  // Wait for auto-start profiling to begin and capture first profile
  await new Promise(resolve => setTimeout(resolve, 1200))

  const profile = await app.sendCommandToService('service', 'generateProfile', { timeout: 5000 })
  assert.ok(profile instanceof Uint8Array, 'Should return Uint8Array from ITC')
  assert.ok(profile.length > 0, 'Profile should have content')

  const lastProfile = await app.sendCommandToService('service', 'getLastProfile')
  assert.ok(lastProfile instanceof Uint8Array, 'Should return Uint8Array from ITC')
  assert.ok(lastProfile.length > 0, 'Profile should have content')

  // Clean up
  await app.sendCommandToService('service', 'stopProfiling')
})
