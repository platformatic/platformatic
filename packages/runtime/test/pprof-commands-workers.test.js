import { deepStrictEqual, equal, ok, rejects } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')
const configFile = join(fixturesDir, 'configs', 'monorepo-workers.json')

function profileBuffer (result) {
  return result instanceof Uint8Array ? result : result?.profile
}

test('should stop profiling on the same worker profiling was started on', async t => {
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // With multiple workers, start and stop must resolve to the same worker
  // even without an explicit worker index.
  await app.startApplicationProfiling('with-logger', { intervalMicros: 1000 })
  await sleep(100)

  const profileData = await app.stopApplicationProfiling('with-logger')

  ok(
    Buffer.isBuffer(profileData) || profileData instanceof Uint8Array,
    'stopApplicationProfiling should return a Buffer or Uint8Array'
  )
  ok(profileData.length > 0, 'Profile data should not be empty')
})

test('should stop profiling on the same worker even when other operations rotate workers', async t => {
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await app.startApplicationProfiling('with-logger', { intervalMicros: 1000 })

  // These calls advance the internal worker round-robin.
  await app.getApplicationDetails('with-logger')
  await app.getApplicationDetails('with-logger')
  await app.getApplicationDetails('with-logger')

  await sleep(100)

  const profileData = await app.stopApplicationProfiling('with-logger')
  ok(profileData.length > 0, 'Profile data should not be empty')
})

test('should pull the last profile from the same worker when no worker index is specified', async t => {
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await app.startApplicationProfiling('with-logger', {
    durationMillis: 100,
    intervalMicros: 1000,
    maxELU: false
  })
  await sleep(250)

  // Two application-level pulls exercise both workers when routed through
  // the general round-robin. Both must instead address the profiled worker.
  const first = await app.getApplicationLastProfile('with-logger')
  const second = await app.getApplicationLastProfile('with-logger')

  ok(profileBuffer(first).length > 0, 'First profile pull should not be empty')
  ok(profileBuffer(second).length > 0, 'Second profile pull should not be empty')

  await app.stopApplicationProfiling('with-logger')
})

test('should profile a specific worker using the application:worker syntax', async t => {
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await app.startApplicationProfiling('with-logger:1', { intervalMicros: 1000 })
  await sleep(100)

  // The other worker has no profiling in progress
  await rejects(
    () => app.stopApplicationProfiling('with-logger:0'),
    err => {
      ok(err.message.includes('not started'))
      return true
    },
    'Should throw for the worker profiling was not started on'
  )

  const profileData = await app.stopApplicationProfiling('with-logger:1')
  ok(profileData.length > 0, 'Profile data should not be empty')
})

test('should start and stop profiling on all workers with the allWorkers option', async t => {
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const started = await app.startApplicationProfiling('with-logger', { intervalMicros: 1000, allWorkers: true })
  deepStrictEqual(started, { workers: [0, 1] }, 'Should report the profiled workers')

  await sleep(100)

  const profiles = await app.stopApplicationProfiling('with-logger', { allWorkers: true })

  ok(Array.isArray(profiles), 'Should return an array of profiles')
  equal(profiles.length, 2, 'Should return one profile per worker')

  deepStrictEqual(
    profiles.map(p => p.workerIndex),
    [0, 1],
    'Each profile should carry its worker index'
  )

  for (const { workerIndex, profile } of profiles) {
    const buffer = profileBuffer(profile)
    ok(buffer instanceof Uint8Array, `Worker ${workerIndex} should return binary profile data`)
    ok(buffer.length > 0, `Worker ${workerIndex} profile should not be empty`)
  }
})

test('allWorkers stop should only return profiles from workers that were profiled', async t => {
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await app.startApplicationProfiling('with-logger:1', { intervalMicros: 1000 })
  await sleep(100)

  const profiles = await app.stopApplicationProfiling('with-logger', { allWorkers: true })

  equal(profiles.length, 1, 'Should return the profile of the only profiled worker')
  equal(profiles[0].workerIndex, 1, 'Should identify the profiled worker')
  ok(profileBuffer(profiles[0].profile).length > 0, 'Profile data should not be empty')
})

test('allWorkers stop should throw when no worker is being profiled', async t => {
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await rejects(
    () => app.stopApplicationProfiling('with-logger', { allWorkers: true }),
    err => {
      ok(err.message.includes('not started'))
      return true
    },
    'Should throw when profiling was never started'
  )
})

test('allWorkers start should throw when every worker is already being profiled', async t => {
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await app.startApplicationProfiling('with-logger', { intervalMicros: 1000, allWorkers: true })

  await rejects(
    () => app.startApplicationProfiling('with-logger', { intervalMicros: 1000, allWorkers: true }),
    err => {
      ok(err.message.includes('already'))
      return true
    },
    'Should throw when profiling is already started on all workers'
  )

  await app.stopApplicationProfiling('with-logger', { allWorkers: true })
})

test('allWorkers start should cover workers that are not profiled yet', async t => {
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Worker 0 is already being profiled: allWorkers should still succeed
  // and cover worker 1 as well.
  await app.startApplicationProfiling('with-logger:0', { intervalMicros: 1000 })

  const started = await app.startApplicationProfiling('with-logger', { intervalMicros: 1000, allWorkers: true })
  deepStrictEqual(started, { workers: [0, 1] }, 'Should report all profiled workers')

  await sleep(100)

  const profiles = await app.stopApplicationProfiling('with-logger', { allWorkers: true })
  equal(profiles.length, 2, 'Should return one profile per worker')
})
