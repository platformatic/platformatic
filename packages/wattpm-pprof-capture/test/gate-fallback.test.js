import assert from 'node:assert'
import test from 'node:test'
import { updateGlobals } from '@platformatic/globals'

// Simulates a runtime without the main-thread gating driver: the pprof
// capture module is installed by the application, not by the runtime, so an
// older runtime with a newer capture module is a legitimate combination. Gate
// registration is rejected with PLT_ITC_HANDLER_NOT_FOUND and the profiler
// must fall back to running ungated instead of starting paused forever.
test('startProfiling should run ungated when the runtime does not support gating', async t => {
  const warnings = []
  const fakeItc = {
    handle () {},
    on () {},
    notify () {},
    async send (name) {
      const error = new Error(`Handler not found for message ${name}`)
      error.code = 'PLT_ITC_HANDLER_NOT_FOUND'
      throw error
    }
  }

  updateGlobals({
    itc: fakeItc,
    logger: {
      warn (_, message) {
        warnings.push(message)
      },
      error () {},
      debug () {}
    }
  })

  const { startProfiling, stopProfiling, getProfilingState } = await import('../index.js')

  await startProfiling({ eluThreshold: 2.0, durationMillis: 100000 })

  const state = getProfilingState()
  assert.strictEqual(state.isCapturing, true)
  assert.strictEqual(state.isProfilerRunning, true, 'Profiler should run ungated without a driver')
  assert.strictEqual(state.isPaused, false, 'Profiler should not wait for a resume that will never come')
  assert.ok(
    warnings.some(w => typeof w === 'string' && w.includes('does not support main-thread profiler gating')),
    'A warning should explain that the gating is unavailable'
  )

  const profile = stopProfiling()
  assert.ok(profile instanceof Uint8Array, 'Stopping should return the captured profile')

  const stoppedState = getProfilingState()
  assert.strictEqual(stoppedState.isCapturing, false)
})
