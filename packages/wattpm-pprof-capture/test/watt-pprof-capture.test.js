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
  const { app } = await createApp(t)

  // Test ProfilingNotStartedError before starting
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile'),
    { code: 'PLT_PPROF_PROFILING_NOT_STARTED' },
    'Should throw ProfilingNotStartedError (not NoProfileAvailableError)'
  )

  // Start profiling with profile rotation
  await app.sendCommandToApplication('service', 'startProfiling', { durationMillis: 500 })

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

test('profiling with eluThreshold should defer start until threshold is reached', async t => {
  const { app, url } = await createApp(t)

  await app.sendCommandToApplication('service', 'startProfiling', {
    eluThreshold: 0.5,
    durationMillis: 500
  })

  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile'),
    { code: 'PLT_PPROF_NO_PROFILE_AVAILABLE' },
    'Should not have profile yet as profiling is waiting for ELU threshold'
  )

  const { statusCode, body } = await request(`${url}/cpu-intensive?timeout=1000`, {
    method: 'POST'
  })
  const error = await body.text()
  assert.strictEqual(statusCode, 200, error)

  await new Promise(resolve => setTimeout(resolve, 600))

  const profile = await app.sendCommandToApplication('service', 'stopProfiling')
  assert.ok(profile instanceof Uint8Array, 'Should get profile after ELU threshold reached')
  assert.ok(profile.length > 0, 'Profile should have content')
})

test('stopping profiling while waiting for ELU should throw NoProfileAvailableError', async t => {
  const { app } = await createApp(t)

  await app.sendCommandToApplication('service', 'startProfiling', {
    eluThreshold: 0.99
  })

  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile'),
    { code: 'PLT_PPROF_NO_PROFILE_AVAILABLE' },
    'Should throw NoProfileAvailableError while waiting for ELU'
  )

  await assert.rejects(
    () => app.sendCommandToApplication('service', 'stopProfiling'),
    { code: 'PLT_PPROF_NO_PROFILE_AVAILABLE' },
    'Should throw NoProfileAvailableError when stopping before profiling started'
  )
})

test('multiple start attempts with eluThreshold should throw error', async t => {
  const { app } = await createApp(t)

  await app.sendCommandToApplication('service', 'startProfiling', {
    eluThreshold: 0.5
  })

  await assert.rejects(
    () => app.sendCommandToApplication('service', 'startProfiling', { eluThreshold: 0.5 }),
    { code: 'PLT_PPROF_PROFILING_ALREADY_STARTED' },
    'Should throw ProfilingAlreadyStartedError while waiting for ELU'
  )

  await assert.rejects(
    () => app.sendCommandToApplication('service', 'stopProfiling'),
    { code: 'PLT_PPROF_NO_PROFILE_AVAILABLE' }
  )
})

test('heap profiling with eluThreshold should work', async t => {
  const { app, url } = await createApp(t)

  await app.sendCommandToApplication('service', 'startProfiling', {
    type: 'heap',
    eluThreshold: 0.5
  })

  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile', { type: 'heap' }),
    { code: 'PLT_PPROF_NO_PROFILE_AVAILABLE' },
    'Should not have heap profile yet'
  )

  const { statusCode } = await request(`${url}/cpu-intensive?timeout=1000`, {
    method: 'POST'
  })
  assert.strictEqual(statusCode, 200)

  await new Promise(resolve => setTimeout(resolve, 600))

  const profile = await app.sendCommandToApplication('service', 'getLastProfile', { type: 'heap' })
  assert.ok(profile instanceof Uint8Array, 'Should get heap profile')

  await app.sendCommandToApplication('service', 'stopProfiling', { type: 'heap' })
})

test('CPU and heap profiling with eluThreshold are independent', async t => {
  const { app } = await createApp(t)

  await app.sendCommandToApplication('service', 'startProfiling', {
    type: 'cpu',
    eluThreshold: 0.99
  })
  await app.sendCommandToApplication('service', 'startProfiling', {
    type: 'heap',
    eluThreshold: 0.99
  })

  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile', { type: 'cpu' }),
    { code: 'PLT_PPROF_NO_PROFILE_AVAILABLE' },
    'CPU should be waiting for ELU'
  )
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'getLastProfile', { type: 'heap' }),
    { code: 'PLT_PPROF_NO_PROFILE_AVAILABLE' },
    'Heap should be waiting for ELU'
  )

  await assert.rejects(
    () => app.sendCommandToApplication('service', 'stopProfiling', { type: 'cpu' }),
    { code: 'PLT_PPROF_NO_PROFILE_AVAILABLE' }
  )
  await assert.rejects(
    () => app.sendCommandToApplication('service', 'stopProfiling', { type: 'heap' }),
    { code: 'PLT_PPROF_NO_PROFILE_AVAILABLE' }
  )
})

test('multiple rotations with eluThreshold should not leak timeouts', async t => {
  const { app, url } = await createApp(t)

  await app.sendCommandToApplication('service', 'startProfiling', {
    eluThreshold: 0.5,
    durationMillis: 300
  })

  const req = request(`${url}/cpu-intensive?timeout=2000`, { method: 'POST' })

  await req

  await new Promise(resolve => setTimeout(resolve, 400))

  const profile = await app.sendCommandToApplication('service', 'stopProfiling')
  assert.ok(profile instanceof Uint8Array, 'Should get final profile')
})
