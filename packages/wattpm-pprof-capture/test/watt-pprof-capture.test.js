import assert from 'node:assert'
import { resolve } from 'node:path'
import test from 'node:test'
import { request } from 'undici'
import { createRuntime } from '../../runtime/test/helpers.js'

async function createApp (t) {
  const configFile = resolve(import.meta.dirname, 'fixtures/runtime-test/platformatic.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  const url = await app.start()
  // Wait for services and handlers to register
  await new Promise(resolve => setTimeout(resolve, 200))

  return { app, url }
}

// Helper to wait for a condition to be true
async function waitForCondition (checkFn, timeoutMs = 5000, pollMs = 100) {
  const startTime = Date.now()
  while (Date.now() - startTime < timeoutMs) {
    if (await checkFn()) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, pollMs))
  }
  throw new Error('Timeout waiting for condition')
}

// Helper to compare Uint8Arrays
function arraysEqual (a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

test('basic service functionality should work with wattpm-pprof-capture', async t => {
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

test('getLastProfile should throw error when profiling not started', async t => {
  const { app } = await createApp(t)

  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile'),
    { code: 'PLT_PPROF_PROFILING_NOT_STARTED' },
    'Should throw ProfilingNotStartedError when profiling not started'
  )
})

test('error types should be distinguishable throughout lifecycle', async t => {
  const { app, url } = await createApp(t)

  // Test ProfilingNotStartedError before starting
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile'),
    { code: 'PLT_PPROF_PROFILING_NOT_STARTED' },
    'Should throw ProfilingNotStartedError (not NoProfileAvailableError)'
  )

  // Test NotEnoughELUError when profiling with high threshold (no CPU load)
  await app.sendCommandToApplication('service', 'startProfiling', { eluThreshold: 2.0, durationMillis: 200 })

  // Wait for profiler to be paused below threshold
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.isPausedBelowThreshold && !state.isProfilerRunning
  }, 2000)

  // getLastProfile should throw NotEnoughELUError
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile'),
    { code: 'PLT_PPROF_NOT_ENOUGH_ELU' },
    'Should throw NotEnoughELUError when ELU threshold not exceeded'
  )

  // Stop profiling
  await app.sendCommandToApplication('service', 'stopProfiling')

  // Start CPU intensive task to generate load for profiler
  await request(`${url}/cpu-intensive/start`, { method: 'POST' })

  // Start profiling with profile rotation (no threshold)
  await app.sendCommandToApplication('service', 'startProfiling', { durationMillis: 500 })

  // Wait for profiler to actually start running
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.isProfilerRunning && !state.hasProfile
  }, 1000)

  // Test NoProfileAvailableError (before any rotation happens)
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile'),
    { code: 'PLT_PPROF_NO_PROFILE_AVAILABLE' },
    'Should throw NoProfileAvailableError (not ProfilingNotStartedError)'
  )

  // Wait for the profile to be captured through rotation
  await new Promise(resolve => setTimeout(resolve, 600))

  // Get the profile (should succeed now)
  const profile = await app.sendCommandToApplication('service', 'getLastProfile')
  assert.ok(profile instanceof Uint8Array, 'Profile should be Uint8Array from ITC')
  assert.ok(profile.length > 0, 'Profile should have content')

  // Test stopping profiling
  const stopResult = await app.sendCommandToApplication('service', 'stopProfiling')
  assert.ok(stopResult instanceof Uint8Array, 'stopProfiling should return final profile')
  assert.ok(stopResult.length > 0, 'Final profile should have content')

  // Stop CPU intensive task
  await request(`${url}/cpu-intensive/stop`, { method: 'POST' })

  // Test ProfilingNotStartedError after stopping
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile'),
    { code: 'PLT_PPROF_PROFILING_NOT_STARTED' },
    'Should throw ProfilingNotStartedError after stopping'
  )
})

test('profiling without rotation should only provide profile on stop', async t => {
  const { app } = await createApp(t)

  // Start profiling without durationMillis (no rotation)
  await app.sendCommandToApplication('service', 'startProfiling', {})

  // Wait some time - should still get NoProfileAvailableError since no rotation
  await new Promise(resolve => setTimeout(resolve, 500))
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile'),
    { code: 'PLT_PPROF_NO_PROFILE_AVAILABLE' },
    'Should throw NoProfileAvailableError without rotation'
  )

  // Stop profiling should return the profile
  const finalProfile = await app.sendCommandToApplication('service', 'stopProfiling')
  assert.ok(finalProfile instanceof Uint8Array, 'Should get final profile from stopProfiling')
  assert.ok(finalProfile.length > 0, 'Final profile should have content')
})

test('multiple start attempts should throw error', async t => {
  const { app } = await createApp(t)

  // Start profiling
  await app.sendCommandToApplication('service', 'startProfiling', { durationMillis: 500 })

  // Try to start again - should throw ProfilingAlreadyStartedError
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'startProfiling', { durationMillis: 500 }),
    { code: 'PLT_PPROF_PROFILING_ALREADY_STARTED' },
    'Should throw ProfilingAlreadyStartedError'
  )

  // Should still be able to get profile after first rotation
  await new Promise(resolve => setTimeout(resolve, 600))
  const profile = await app.sendCommandToApplication('service', 'getLastProfile')
  assert.ok(profile instanceof Uint8Array, 'Should get Uint8Array from ITC')

  await app.sendCommandToApplication('service', 'stopProfiling')
})

test('multiple stop attempts should throw error', async t => {
  const { app } = await createApp(t)

  // Start and stop profiling
  await app.sendCommandToApplication('service', 'startProfiling', { durationMillis: 500 })
  await app.sendCommandToApplication('service', 'stopProfiling')

  // Try to stop again - should throw ProfilingNotStartedError
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'stopProfiling'),
    { code: 'PLT_PPROF_PROFILING_NOT_STARTED' },
    'Should throw ProfilingNotStartedError on double stop'
  )
})

test('stopProfiling should throw error when called without starting', async t => {
  const { app } = await createApp(t)

  // Try to stop without starting
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'stopProfiling'),
    { code: 'PLT_PPROF_PROFILING_NOT_STARTED' },
    'Should throw ProfilingNotStartedError'
  )
})

test('profile rotation should update available profiles', async t => {
  const { app } = await createApp(t)

  // Start with short rotation interval
  await app.sendCommandToApplication('service', 'startProfiling', { durationMillis: 200 })

  // Wait for first rotation
  await new Promise(resolve => setTimeout(resolve, 250))
  const profile1 = await app.sendCommandToApplication('service', 'getLastProfile')
  assert.ok(profile1 instanceof Uint8Array)

  // Wait for second rotation
  await new Promise(resolve => setTimeout(resolve, 250))
  const profile2 = await app.sendCommandToApplication('service', 'getLastProfile')
  assert.ok(profile2 instanceof Uint8Array)

  // Profiles should be the latest captured (may or may not be different)
  // The important thing is that we can get profiles after each rotation

  await app.sendCommandToApplication('service', 'stopProfiling')
})

test('getLastProfile should return same profile until next rotation', async t => {
  const { app } = await createApp(t)

  await app.sendCommandToApplication('service', 'startProfiling', { durationMillis: 500 })

  // Wait for first rotation
  await new Promise(resolve => setTimeout(resolve, 600))

  // Multiple getLastProfile calls should return the same profile
  const profile1 = await app.sendCommandToApplication('service', 'getLastProfile')
  const profile2 = await app.sendCommandToApplication('service', 'getLastProfile')
  const profile3 = await app.sendCommandToApplication('service', 'getLastProfile')

  assert.ok(profile1 instanceof Uint8Array)
  assert.ok(profile2 instanceof Uint8Array)
  assert.ok(profile3 instanceof Uint8Array)

  // All should be the same profile (latest captured)
  assert.deepStrictEqual(profile1, profile2, 'Should return same profile')
  assert.deepStrictEqual(profile2, profile3, 'Should return same profile')

  await app.sendCommandToApplication('service', 'stopProfiling')
})

test('heap profiling should work', async t => {
  const { app } = await createApp(t)

  // Start heap profiling
  await app.sendCommandToApplication('service', 'startProfiling', { type: 'heap' })

  // Wait a bit for some allocations
  await new Promise(resolve => setTimeout(resolve, 200))

  // Stop heap profiling and get profile
  const profile = await app.sendCommandToApplication('service', 'stopProfiling', { type: 'heap' })
  assert.ok(profile instanceof Uint8Array, 'Heap profile should be Uint8Array')
  assert.ok(profile.length > 0, 'Heap profile should have content')
})

test('heap profiling should throw error when not started', async t => {
  const { app } = await createApp(t)

  // Try to stop heap profiling without starting
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'stopProfiling', { type: 'heap' }),
    { code: 'PLT_PPROF_PROFILING_NOT_STARTED' },
    'Should throw ProfilingNotStartedError for heap profiling'
  )
})

test('heap profiling multiple start attempts should throw error', async t => {
  const { app } = await createApp(t)

  // Start heap profiling
  await app.sendCommandToApplication('service', 'startProfiling', { type: 'heap' })

  // Try to start again - should throw ProfilingAlreadyStartedError
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'startProfiling', { type: 'heap' }),
    { code: 'PLT_PPROF_PROFILING_ALREADY_STARTED' },
    'Should throw ProfilingAlreadyStartedError for heap profiling'
  )

  await app.sendCommandToApplication('service', 'stopProfiling', { type: 'heap' })
})

test('concurrent CPU and heap profiling should work', async t => {
  const { app } = await createApp(t)

  // Start both CPU and heap profiling
  await app.sendCommandToApplication('service', 'startProfiling', { type: 'cpu' })
  await app.sendCommandToApplication('service', 'startProfiling', { type: 'heap' })

  // Wait a bit for data
  await new Promise(resolve => setTimeout(resolve, 200))

  // Stop both and get profiles
  const cpuProfile = await app.sendCommandToApplication('service', 'stopProfiling', { type: 'cpu' })
  const heapProfile = await app.sendCommandToApplication('service', 'stopProfiling', { type: 'heap' })

  assert.ok(cpuProfile instanceof Uint8Array, 'CPU profile should be Uint8Array')
  assert.ok(cpuProfile.length > 0, 'CPU profile should have content')
  assert.ok(heapProfile instanceof Uint8Array, 'Heap profile should be Uint8Array')
  assert.ok(heapProfile.length > 0, 'Heap profile should have content')
})

test('heap profiling getLastProfile should return current heap snapshot', async t => {
  const { app } = await createApp(t)

  // Start heap profiling
  await app.sendCommandToApplication('service', 'startProfiling', { type: 'heap' })

  // Wait a bit for allocations
  await new Promise(resolve => setTimeout(resolve, 200))

  // Get last profile should work for heap (returns current snapshot)
  const profile1 = await app.sendCommandToApplication('service', 'getLastProfile', { type: 'heap' })
  assert.ok(profile1 instanceof Uint8Array, 'Heap profile should be Uint8Array')
  assert.ok(profile1.length > 0, 'Heap profile should have content')

  // Get another snapshot
  await new Promise(resolve => setTimeout(resolve, 100))
  const profile2 = await app.sendCommandToApplication('service', 'getLastProfile', { type: 'heap' })
  assert.ok(profile2 instanceof Uint8Array, 'Heap profile should be Uint8Array')

  await app.sendCommandToApplication('service', 'stopProfiling', { type: 'heap' })
})

test('CPU and heap profiling are independent', async t => {
  const { app } = await createApp(t)

  // Start only CPU profiling
  await app.sendCommandToApplication('service', 'startProfiling', { type: 'cpu' })

  // Heap profiling should not be started
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'stopProfiling', { type: 'heap' }),
    { code: 'PLT_PPROF_PROFILING_NOT_STARTED' },
    'Heap profiling should not be started'
  )

  // CPU profiling should work
  const cpuProfile = await app.sendCommandToApplication('service', 'stopProfiling', { type: 'cpu' })
  assert.ok(cpuProfile instanceof Uint8Array, 'CPU profile should work')

  // Now start heap profiling
  await app.sendCommandToApplication('service', 'startProfiling', { type: 'heap' })

  // CPU profiling should not be started anymore
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'stopProfiling', { type: 'cpu' }),
    { code: 'PLT_PPROF_PROFILING_NOT_STARTED' },
    'CPU profiling should not be started'
  )

  // Heap profiling should work
  const heapProfile = await app.sendCommandToApplication('service', 'stopProfiling', { type: 'heap' })
  assert.ok(heapProfile instanceof Uint8Array, 'Heap profile should work')
})

test('profiling with eluThreshold should not start when below threshold', async t => {
  const { app } = await createApp(t)

  // Start profiling with a very high threshold (above 1.0, which is impossible)
  await app.sendCommandToApplication('service', 'startProfiling', { eluThreshold: 2.0, durationMillis: 200 })

  // Wait a bit - profiler should not have started
  await new Promise(resolve => setTimeout(resolve, 300))

  // getLastProfile should throw NotEnoughELUError since ELU threshold not exceeded
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile'),
    { code: 'PLT_PPROF_NOT_ENOUGH_ELU' },
    'Should throw NotEnoughELUError when ELU threshold not exceeded'
  )

  // Stop profiling
  const profile = await app.sendCommandToApplication('service', 'stopProfiling')
  assert.ok(profile instanceof Uint8Array, 'Should return Uint8Array')
  // Profile will be empty or have minimal content since profiler never actually ran
})

test('profiling with eluThreshold should start when utilization exceeds threshold', async t => {
  const { app, url } = await createApp(t)

  // Start profiling with a low threshold
  await app.sendCommandToApplication('service', 'startProfiling', { eluThreshold: 0.5, durationMillis: 500 })

  // Start CPU intensive task to increase ELU
  await request(`${url}/cpu-intensive/start`, { method: 'POST' })

  // Wait for profiler to actually start running
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.isProfilerRunning
  }, 3000)

  // Wait for a profile to be captured
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.hasProfile
  }, 2000)

  // Profile should be available now
  const profile = await app.sendCommandToApplication('service', 'getLastProfile')
  assert.ok(profile instanceof Uint8Array, 'Should get profile after threshold exceeded')
  assert.ok(profile.length > 0, 'Profile should have content')

  // Stop CPU intensive task
  await request(`${url}/cpu-intensive/stop`, { method: 'POST' })

  await app.sendCommandToApplication('service', 'stopProfiling')
})

test('profiling with eluThreshold should work with heap profiling', async t => {
  const { app } = await createApp(t)

  // Start heap profiling with a very high threshold
  await app.sendCommandToApplication('service', 'startProfiling', { type: 'heap', eluThreshold: 2.0 })

  // Wait a bit - profiler should not have started due to low ELU
  await new Promise(resolve => setTimeout(resolve, 200))

  // getLastProfile should throw NotEnoughELUError since ELU threshold not exceeded
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile', { type: 'heap' }),
    { code: 'PLT_PPROF_NOT_ENOUGH_ELU' },
    'Should throw NotEnoughELUError when heap profiler ELU threshold not exceeded'
  )

  // Stop profiling
  const profile = await app.sendCommandToApplication('service', 'stopProfiling', { type: 'heap' })
  assert.ok(profile instanceof Uint8Array, 'Should return Uint8Array')
})

test('eluThreshold profiling should allow double start error', async t => {
  const { app } = await createApp(t)

  // Start profiling with eluThreshold
  await app.sendCommandToApplication('service', 'startProfiling', { eluThreshold: 0.5 })

  // Try to start again - should throw ProfilingAlreadyStartedError
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'startProfiling', { eluThreshold: 0.5 }),
    { code: 'PLT_PPROF_PROFILING_ALREADY_STARTED' },
    'Should throw ProfilingAlreadyStartedError'
  )

  await app.sendCommandToApplication('service', 'stopProfiling')
})

test('profiling with eluThreshold should not start when always below threshold', async t => {
  const { app } = await createApp(t)

  // Start profiling with very high threshold (impossible to reach without CPU task)
  await app.sendCommandToApplication('service', 'startProfiling', { eluThreshold: 1.5, durationMillis: 300 })

  // Wait for state to show we're paused below threshold
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.isPausedBelowThreshold && !state.isProfilerRunning
  }, 2000)

  // Stop profiling - should return empty profile since profiler never started
  const profileBeforeThreshold = await app.sendCommandToApplication('service', 'stopProfiling')
  assert.ok(profileBeforeThreshold instanceof Uint8Array, 'Should return Uint8Array')
  assert.ok(profileBeforeThreshold.length === 0, 'Profile should be empty since profiler never started')
})

test('profiling with eluThreshold should start when threshold is reached', async t => {
  const { app, url } = await createApp(t)

  // Start profiling while ELU is low
  await app.sendCommandToApplication('service', 'startProfiling', { eluThreshold: 0.5, durationMillis: 300 })

  // Start CPU intensive task to raise ELU above threshold
  await request(`${url}/cpu-intensive/start`, { method: 'POST' })

  // Wait for profiler to actually start running
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.isProfilerRunning
  }, 3000)

  // Wait for a profile to be captured
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.hasProfile
  }, 2000)

  // Now profile should be available
  const profileAfterThreshold = await app.sendCommandToApplication('service', 'getLastProfile')
  assert.ok(profileAfterThreshold instanceof Uint8Array, 'Should get profile after threshold exceeded')
  assert.ok(profileAfterThreshold.length > 0, 'Profile should have content after threshold exceeded')

  // Clean up
  await request(`${url}/cpu-intensive/stop`, { method: 'POST' })
  await app.sendCommandToApplication('service', 'stopProfiling')
})

test('profiling with eluThreshold should pause during rotation when below threshold', async t => {
  const { app, url } = await createApp(t)

  // Start CPU intensive task first
  await request(`${url}/cpu-intensive/start`, { method: 'POST' })

  // Wait for ELU to rise above threshold
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.lastELU != null && state.lastELU > 0.5
  }, 3000)

  // Start profiling with threshold and rotation interval
  await app.sendCommandToApplication('service', 'startProfiling', { eluThreshold: 0.5, durationMillis: 500 })

  // Wait for profiler to start
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.isProfilerRunning
  }, 2000)

  // Wait for a profile to be captured
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.hasProfile
  }, 2000)

  // Get first profile - should have content
  const profile1 = await app.sendCommandToApplication('service', 'getLastProfile')
  assert.ok(profile1 instanceof Uint8Array, 'First profile should be available')
  assert.ok(profile1.length > 0, 'First profile should have content')

  // Stop CPU intensive task - ELU should drop below stop threshold (0.4)
  await request(`${url}/cpu-intensive/stop`, { method: 'POST' })

  // Wait for profiler to detect low ELU and pause
  // This waits for both ELU to drop AND for the next rotation to detect it
  // ELU drops slowly as the rolling average window moves past the high-ELU period
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return !state.isProfilerRunning && state.isPausedBelowThreshold
  }, 15000)

  // Verify profiler has paused
  const state = await app.sendCommandToApplication('service', 'getProfilingState')
  assert.ok(!state.isProfilerRunning, 'Profiler should have stopped running')
  assert.ok(state.isPausedBelowThreshold, 'Should be paused below threshold')

  // Clean up
  await app.sendCommandToApplication('service', 'stopProfiling')
})

test('profiling with eluThreshold should start immediately when already above threshold', async t => {
  const { app, url } = await createApp(t)

  // Start CPU intensive task BEFORE starting profiling
  await request(`${url}/cpu-intensive/start`, { method: 'POST' })

  // Wait for ELU to actually rise above threshold
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.lastELU != null && state.lastELU > 0.5
  }, 5000)

  // Now start profiling - should start immediately since ELU is already high
  await app.sendCommandToApplication('service', 'startProfiling', { eluThreshold: 0.5, durationMillis: 300 })

  // Profiler should start immediately without being paused
  const stateAfterStart = await app.sendCommandToApplication('service', 'getProfilingState')
  assert.ok(stateAfterStart.isProfilerRunning, 'Profiler should start immediately when ELU is already high')
  assert.ok(!stateAfterStart.isPausedBelowThreshold, 'Should not be paused below threshold')

  // Wait for a profile to be captured
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.hasProfile
  })

  // Profile should be available after first rotation
  const profile = await app.sendCommandToApplication('service', 'getLastProfile')
  assert.ok(profile instanceof Uint8Array, 'Profile should be available after rotation')
  assert.ok(profile.length > 0, 'Profile should have content')

  // Clean up
  await request(`${url}/cpu-intensive/stop`, { method: 'POST' })
  await app.sendCommandToApplication('service', 'stopProfiling')
})

test('profiling with eluThreshold should continue rotating while above threshold', async t => {
  const { app, url } = await createApp(t)

  // Start CPU intensive task
  await request(`${url}/cpu-intensive/start`, { method: 'POST' })

  // Wait for ELU to rise above threshold
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.lastELU != null && state.lastELU > 0.5
  }, 3000)

  // Start profiling with rotation interval
  await app.sendCommandToApplication('service', 'startProfiling', { eluThreshold: 0.5, durationMillis: 400 })

  // Wait for profiler to start
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.isProfilerRunning
  }, 2000)

  // Wait for first profile
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.hasProfile
  }, 2000)

  // Get first profile
  const profile1 = await app.sendCommandToApplication('service', 'getLastProfile')
  assert.ok(profile1 instanceof Uint8Array, 'First profile should be available')
  assert.ok(profile1.length > 0, 'First profile should have content')

  // Wait for second rotation to capture a new profile
  await waitForCondition(async () => {
    const profile = await app.sendCommandToApplication('service', 'getLastProfile')
    return !arraysEqual(profile, profile1)
  }, 2000)

  // Get second profile
  const profile2 = await app.sendCommandToApplication('service', 'getLastProfile')
  assert.ok(profile2 instanceof Uint8Array, 'Second profile should be available')
  assert.ok(profile2.length > 0, 'Second profile should have content')

  // Profiles should be different (captured at different times)
  assert.ok(!arraysEqual(profile1, profile2), 'Profiles should be different after rotation')

  // Clean up
  await request(`${url}/cpu-intensive/stop`, { method: 'POST' })
  await app.sendCommandToApplication('service', 'stopProfiling')
})

test('latestProfileTimestamp should be set after profile rotation', async t => {
  const { app } = await createApp(t)

  // Check initial state - timestamp should be null
  const initialState = await app.sendCommandToApplication('service', 'getProfilingState')
  assert.strictEqual(initialState.latestProfileTimestamp, null, 'Timestamp should be null before profiling')

  // Start profiling with rotation
  await app.sendCommandToApplication('service', 'startProfiling', { durationMillis: 200 })

  // Wait for first rotation
  await new Promise(resolve => setTimeout(resolve, 250))

  // Get state and verify timestamp is set
  const stateAfterRotation = await app.sendCommandToApplication('service', 'getProfilingState')
  assert.ok(stateAfterRotation.latestProfileTimestamp != null, 'Timestamp should be set after rotation')
  assert.ok(typeof stateAfterRotation.latestProfileTimestamp === 'number', 'Timestamp should be a number')
  assert.ok(stateAfterRotation.latestProfileTimestamp <= Date.now(), 'Timestamp should not be in the future')
  assert.ok(stateAfterRotation.latestProfileTimestamp > Date.now() - 5000, 'Timestamp should be recent')

  await app.sendCommandToApplication('service', 'stopProfiling')
})

test('latestProfileTimestamp should be set after stopProfiling', async t => {
  const { app } = await createApp(t)

  // Start profiling without rotation
  await app.sendCommandToApplication('service', 'startProfiling', {})

  // Get state before stop - timestamp should be null (no rotation occurred)
  const stateBeforeStop = await app.sendCommandToApplication('service', 'getProfilingState')
  assert.strictEqual(stateBeforeStop.latestProfileTimestamp, null, 'Timestamp should be null before stop')

  // Stop profiling
  const beforeStopTime = Date.now()
  await app.sendCommandToApplication('service', 'stopProfiling')
  const afterStopTime = Date.now()

  // Get state after stop - timestamp should be set
  const stateAfterStop = await app.sendCommandToApplication('service', 'getProfilingState')
  assert.ok(stateAfterStop.latestProfileTimestamp != null, 'Timestamp should be set after stopProfiling')
  assert.ok(stateAfterStop.latestProfileTimestamp >= beforeStopTime, 'Timestamp should be >= time before stop')
  assert.ok(stateAfterStop.latestProfileTimestamp <= afterStopTime, 'Timestamp should be <= time after stop')
})

test('latestProfileTimestamp should be cleared after profile cleanup timeout', async t => {
  const { app } = await createApp(t)

  // Start profiling with short rotation interval
  await app.sendCommandToApplication('service', 'startProfiling', { durationMillis: 200 })

  // Wait for first rotation
  await new Promise(resolve => setTimeout(resolve, 250))

  // Verify timestamp is set
  const stateWithProfile = await app.sendCommandToApplication('service', 'getProfilingState')
  assert.ok(stateWithProfile.latestProfileTimestamp != null, 'Timestamp should be set after rotation')
  assert.ok(stateWithProfile.hasProfile, 'Should have profile')

  // Stop profiling - this schedules cleanup after durationMillis (200ms)
  await app.sendCommandToApplication('service', 'stopProfiling')

  // Wait for cleanup timeout (durationMillis after stop)
  await new Promise(resolve => setTimeout(resolve, 300))

  // Verify timestamp is cleared after cleanup
  const stateAfterCleanup = await app.sendCommandToApplication('service', 'getProfilingState')
  assert.strictEqual(stateAfterCleanup.latestProfileTimestamp, null, 'Timestamp should be cleared after cleanup')
  assert.ok(!stateAfterCleanup.hasProfile, 'Profile should be cleared')
})

test('latestProfileTimestamp should be set for heap profiling', async t => {
  const { app } = await createApp(t)

  // Check initial state for heap - timestamp should be null
  const initialState = await app.sendCommandToApplication('service', 'getProfilingState', { type: 'heap' })
  assert.strictEqual(initialState.latestProfileTimestamp, null, 'Heap timestamp should be null before profiling')

  // Start heap profiling
  await app.sendCommandToApplication('service', 'startProfiling', { type: 'heap' })

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 100))

  // Get last profile (for heap, this captures a snapshot)
  const beforeGetProfile = Date.now()
  await app.sendCommandToApplication('service', 'getLastProfile', { type: 'heap' })
  const afterGetProfile = Date.now()

  // Verify timestamp is set after getLastProfile for heap
  const stateAfterGet = await app.sendCommandToApplication('service', 'getProfilingState', { type: 'heap' })
  assert.ok(stateAfterGet.latestProfileTimestamp != null, 'Heap timestamp should be set after getLastProfile')
  assert.ok(stateAfterGet.latestProfileTimestamp >= beforeGetProfile, 'Timestamp should be >= time before get')
  assert.ok(stateAfterGet.latestProfileTimestamp <= afterGetProfile, 'Timestamp should be <= time after get')

  await app.sendCommandToApplication('service', 'stopProfiling', { type: 'heap' })
})

test('latestProfileTimestamp should update with each rotation', async t => {
  const { app } = await createApp(t)

  // Start profiling with short rotation interval
  await app.sendCommandToApplication('service', 'startProfiling', { durationMillis: 200 })

  // Wait for first rotation
  await new Promise(resolve => setTimeout(resolve, 250))
  const stateAfterFirst = await app.sendCommandToApplication('service', 'getProfilingState')
  const firstTimestamp = stateAfterFirst.latestProfileTimestamp
  assert.ok(firstTimestamp != null, 'Timestamp should be set after first rotation')

  // Wait for second rotation
  await new Promise(resolve => setTimeout(resolve, 250))
  const stateAfterSecond = await app.sendCommandToApplication('service', 'getProfilingState')
  const secondTimestamp = stateAfterSecond.latestProfileTimestamp

  // Second timestamp should be greater than first
  assert.ok(secondTimestamp > firstTimestamp, 'Timestamp should update with each rotation')

  await app.sendCommandToApplication('service', 'stopProfiling')
})

test('force flag should capture profile when paused below ELU threshold', async t => {
  const { app } = await createApp(t)

  // Start profiling with max threshold (impossible to reach)
  await app.sendCommandToApplication('service', 'startProfiling', {
    eluThreshold: 1,
    durationMillis: 500
  })

  // Wait for state to show we're paused below threshold
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.isPausedBelowThreshold && !state.isProfilerRunning
  }, 2000)

  // Verify profiler is paused and no profile available
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile'),
    { code: 'PLT_PPROF_NOT_ENOUGH_ELU' },
    'Should throw NotEnoughELUError when paused below threshold'
  )

  // Force capture a profile
  await app.sendCommandToApplication('service', 'startProfiling', {
    force: true,
    durationMillis: 200
  })

  // Profiler should now be running
  const stateAfterForce = await app.sendCommandToApplication('service', 'getProfilingState')
  assert.ok(stateAfterForce.isProfilerRunning, 'Profiler should be running after force')

  // Wait for forced capture to complete
  await new Promise(resolve => setTimeout(resolve, 300))

  // Profile should be available
  const profile = await app.sendCommandToApplication('service', 'getLastProfile')
  assert.ok(profile instanceof Uint8Array, 'Profile should be available after forced capture')
  assert.ok(profile.length > 0, 'Profile should have content')

  // Profiler should be paused again (ELU is still below threshold)
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.isPausedBelowThreshold && !state.isProfilerRunning
  }, 2000)

  await app.sendCommandToApplication('service', 'stopProfiling')
})

test('force flag should throw when profiler is already running', async t => {
  const { app, url } = await createApp(t)

  // Start CPU intensive task to raise ELU
  await request(`${url}/cpu-intensive/start`, { method: 'POST' })

  // Wait for ELU to rise
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.lastELU != null && state.lastELU > 0.5
  }, 3000)

  // Start profiling with threshold - profiler should start immediately
  await app.sendCommandToApplication('service', 'startProfiling', {
    eluThreshold: 0.5,
    durationMillis: 500
  })

  // Wait for profiler to start
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.isProfilerRunning
  }, 2000)

  // Force should throw because profiler is already running
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'startProfiling', { force: true, durationMillis: 200 }),
    { code: 'PLT_PPROF_PROFILING_ALREADY_STARTED' },
    'Should throw ProfilingAlreadyStartedError when profiler is already running'
  )

  // Clean up
  await request(`${url}/cpu-intensive/stop`, { method: 'POST' })
  await app.sendCommandToApplication('service', 'stopProfiling')
})
