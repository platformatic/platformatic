import { equal, ok, rejects } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')
const configFile = join(fixturesDir, 'configs', 'monorepo-workers', 'platformatic.json')

// Continuous profiling completes a window every durationMillis: wait until
// the given workers of the application have captured at least one window.
function waitForProfileCaptured (app, application, workersCount = 1) {
  return new Promise(resolve => {
    const seen = new Set()

    function listener (payload) {
      if (payload.application !== application) {
        return
      }

      seen.add(payload.worker)

      if (seen.size >= workersCount) {
        app.off('application:worker:profile:captured', listener)
        resolve()
      }
    }

    app.on('application:worker:profile:captured', listener)
  })
}

test('should return the last profile of an application regardless of worker rotation', async t => {
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Profile a single specific worker
  const captured = waitForProfileCaptured(app, 'with-logger')
  await app.startApplicationProfiling('with-logger:1', { durationMillis: 500 })
  await captured

  // With two workers, consecutive application-level calls must all resolve to
  // a worker with a live window: a round-robin resolution would rotate to the
  // unprofiled worker.
  for (let i = 0; i < 4; i++) {
    const { profile, timestamp, preserved } = await app.getApplicationLastProfile('with-logger')

    ok(profile instanceof Uint8Array, 'Should return the profile')
    ok(profile.length > 0, 'Profile should not be empty')
    equal(typeof timestamp, 'number', 'Should return the window timestamp')
    equal(preserved, false, 'Should be a live window')
  }

  await app.stopApplicationProfiling('with-logger:1')
})

test('should return the newest window across all workers for an application-level id', async t => {
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Profile both workers and wait until each one has captured a window
  const captured = waitForProfileCaptured(app, 'with-logger', 2)
  await app.startApplicationProfiling('with-logger:0', { durationMillis: 500 })
  await app.startApplicationProfiling('with-logger:1', { durationMillis: 500 })
  await captured

  const worker0 = await app.getApplicationLastProfile('with-logger:0')
  const worker1 = await app.getApplicationLastProfile('with-logger:1')
  const combined = await app.getApplicationLastProfile('with-logger')

  ok(combined.profile.length > 0, 'Profile should not be empty')
  equal(combined.preserved, false, 'Should be a live window')
  ok(
    combined.timestamp >= Math.max(worker0.timestamp, worker1.timestamp),
    'The application-level profile should not be older than any worker window'
  )

  await app.stopApplicationProfiling('with-logger:0')
  await app.stopApplicationProfiling('with-logger:1')
})

test('should keep addressing a single worker when the worker index is explicit', async t => {
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const captured = waitForProfileCaptured(app, 'with-logger')
  await app.startApplicationProfiling('with-logger:1', { durationMillis: 500 })
  await captured

  const { profile, preserved } = await app.getApplicationLastProfile('with-logger:1')
  ok(profile.length > 0, 'Profile should not be empty')
  equal(preserved, false, 'Should be a live window')

  // The other worker has no profiling in progress and no preserved profile
  await rejects(
    () => app.getApplicationLastProfile('with-logger:0'),
    err => {
      equal(err.code, 'PLT_PPROF_PROFILING_NOT_STARTED')
      return true
    },
    'Should not serve another worker window for an explicit worker id'
  )

  await app.stopApplicationProfiling('with-logger:1')
})

test('should throw when no worker of the application is being profiled', async t => {
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await rejects(
    () => app.getApplicationLastProfile('with-logger'),
    err => {
      equal(err.code, 'PLT_PPROF_PROFILING_NOT_STARTED')
      return true
    },
    'Should throw when profiling was never started'
  )
})
