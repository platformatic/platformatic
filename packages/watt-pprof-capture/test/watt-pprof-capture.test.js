'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { resolve } = require('node:path')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('@platformatic/runtime')

async function createApp (t) {
  const configFile = resolve(__dirname, 'fixtures/runtime-test/platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
  })

  const url = await app.start()
  // Wait for services and handlers to register
  await new Promise(resolve => setTimeout(resolve, 200))

  return { app, url }
}

test('basic service functionality should work with watt-pprof-capture', async (t) => {
  const { url } = await createApp(t)

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
})

test('getLastProfile should throw error when profiling not started', async (t) => {
  const { app } = await createApp(t)

  await assert.rejects(
    () => app.sendCommandToService('service', 'getLastProfile'),
    { code: 'PLT_PPROF_PROFILING_NOT_STARTED' },
    'Should throw ProfilingNotStartedError when profiling not started'
  )
})

test('error types should be distinguishable throughout lifecycle', async (t) => {
  const { app } = await createApp(t)

  // Test ProfilingNotStartedError before starting
  await assert.rejects(
    () => app.sendCommandToService('service', 'getLastProfile'),
    { code: 'PLT_PPROF_PROFILING_NOT_STARTED' },
    'Should throw ProfilingNotStartedError (not NoProfileAvailableError)'
  )

  // Start profiling with profile rotation
  await app.sendCommandToService('service', 'startProfiling', { durationMillis: 500 })

  // Test NoProfileAvailableError (before any rotation happens)
  await assert.rejects(
    () => app.sendCommandToService('service', 'getLastProfile'),
    { code: 'PLT_PPROF_NO_PROFILE_AVAILABLE' },
    'Should throw NoProfileAvailableError (not ProfilingNotStartedError)'
  )

  // Wait for the profile to be captured through rotation
  await new Promise(resolve => setTimeout(resolve, 600))

  // Get the profile (should succeed now)
  const profile = await app.sendCommandToService('service', 'getLastProfile')
  assert.ok(profile instanceof Uint8Array, 'Profile should be Uint8Array from ITC')
  assert.ok(profile.length > 0, 'Profile should have content')

  // Test stopping profiling
  const stopResult = await app.sendCommandToService('service', 'stopProfiling')
  assert.ok(stopResult instanceof Uint8Array, 'stopProfiling should return final profile')
  assert.ok(stopResult.length > 0, 'Final profile should have content')

  // Test ProfilingNotStartedError after stopping
  await assert.rejects(
    () => app.sendCommandToService('service', 'getLastProfile'),
    { code: 'PLT_PPROF_PROFILING_NOT_STARTED' },
    'Should throw ProfilingNotStartedError after stopping'
  )
})

test('profiling without rotation should only provide profile on stop', async (t) => {
  const { app } = await createApp(t)

  // Start profiling without durationMillis (no rotation)
  await app.sendCommandToService('service', 'startProfiling', {})

  // Wait some time - should still get NoProfileAvailableError since no rotation
  await new Promise(resolve => setTimeout(resolve, 500))
  await assert.rejects(
    () => app.sendCommandToService('service', 'getLastProfile'),
    { code: 'PLT_PPROF_NO_PROFILE_AVAILABLE' },
    'Should throw NoProfileAvailableError without rotation'
  )

  // Stop profiling should return the profile
  const finalProfile = await app.sendCommandToService('service', 'stopProfiling')
  assert.ok(finalProfile instanceof Uint8Array, 'Should get final profile from stopProfiling')
  assert.ok(finalProfile.length > 0, 'Final profile should have content')
})

test('multiple start attempts should throw error', async (t) => {
  const { app } = await createApp(t)

  // Start profiling
  await app.sendCommandToService('service', 'startProfiling', { durationMillis: 500 })

  // Try to start again - should throw ProfilingAlreadyStartedError
  await assert.rejects(
    () => app.sendCommandToService('service', 'startProfiling', { durationMillis: 500 }),
    { code: 'PLT_PPROF_PROFILING_ALREADY_STARTED' },
    'Should throw ProfilingAlreadyStartedError'
  )

  // Should still be able to get profile after first rotation
  await new Promise(resolve => setTimeout(resolve, 600))
  const profile = await app.sendCommandToService('service', 'getLastProfile')
  assert.ok(profile instanceof Uint8Array, 'Should get Uint8Array from ITC')

  await app.sendCommandToService('service', 'stopProfiling')
})

test('multiple stop attempts should throw error', async (t) => {
  const { app } = await createApp(t)

  // Start and stop profiling
  await app.sendCommandToService('service', 'startProfiling', { durationMillis: 500 })
  await app.sendCommandToService('service', 'stopProfiling')

  // Try to stop again - should throw ProfilingNotStartedError
  await assert.rejects(
    () => app.sendCommandToService('service', 'stopProfiling'),
    { code: 'PLT_PPROF_PROFILING_NOT_STARTED' },
    'Should throw ProfilingNotStartedError on double stop'
  )
})

test('stopProfiling should throw error when called without starting', async (t) => {
  const { app } = await createApp(t)

  // Try to stop without starting
  await assert.rejects(
    () => app.sendCommandToService('service', 'stopProfiling'),
    { code: 'PLT_PPROF_PROFILING_NOT_STARTED' },
    'Should throw ProfilingNotStartedError'
  )
})

test('profile rotation should update available profiles', async (t) => {
  const { app } = await createApp(t)

  // Start with short rotation interval
  await app.sendCommandToService('service', 'startProfiling', { durationMillis: 200 })

  // Wait for first rotation
  await new Promise(resolve => setTimeout(resolve, 250))
  const profile1 = await app.sendCommandToService('service', 'getLastProfile')
  assert.ok(profile1 instanceof Uint8Array)

  // Wait for second rotation
  await new Promise(resolve => setTimeout(resolve, 250))
  const profile2 = await app.sendCommandToService('service', 'getLastProfile')
  assert.ok(profile2 instanceof Uint8Array)

  // Profiles should be the latest captured (may or may not be different)
  // The important thing is that we can get profiles after each rotation

  await app.sendCommandToService('service', 'stopProfiling')
})

test('getLastProfile should return same profile until next rotation', async (t) => {
  const { app } = await createApp(t)

  await app.sendCommandToService('service', 'startProfiling', { durationMillis: 500 })

  // Wait for first rotation
  await new Promise(resolve => setTimeout(resolve, 600))

  // Multiple getLastProfile calls should return the same profile
  const profile1 = await app.sendCommandToService('service', 'getLastProfile')
  const profile2 = await app.sendCommandToService('service', 'getLastProfile')
  const profile3 = await app.sendCommandToService('service', 'getLastProfile')

  assert.ok(profile1 instanceof Uint8Array)
  assert.ok(profile2 instanceof Uint8Array)
  assert.ok(profile3 instanceof Uint8Array)

  // All should be the same profile (latest captured)
  assert.deepStrictEqual(profile1, profile2, 'Should return same profile')
  assert.deepStrictEqual(profile2, profile3, 'Should return same profile')

  await app.sendCommandToService('service', 'stopProfiling')
})
