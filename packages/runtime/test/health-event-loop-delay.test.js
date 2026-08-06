import { fail, ok, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')
const isWindows = process.platform === 'win32'

async function waitForMetric (app, applicationId, predicate, timeout = 15000) {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const [metric] = await once(app, 'application:worker:health:metrics')

    if (metric.application === applicationId && predicate(metric)) {
      return metric
    }
  }

  fail('Timed out waiting for the expected health metric')
}

test(
  'the event loop delay is sampled in the worker and reported as a health signal',
  { skip: isWindows && 'Skipping on Windows' },
  async t => {
    const configFile = join(fixturesDir, 'event-loop-delay', 'platformatic-signals.json')
    const app = await createRuntime(configFile)

    t.after(async () => {
      await app.close()
    })

    const { 'main:0': url } = await app.start()

    // Stall the worker: 200ms blocks every 400ms keep the ELU moderate while
    // producing long individual stalls
    await request(`${url}/stall/start?block=200&period=400`, { method: 'POST' })

    const metric = await waitForMetric(app, 'main', m =>
      m.healthSignals.some(s => s.type === 'eventLoopDelay' && s.max >= 100)
    )

    const signal = metric.healthSignals.find(s => s.type === 'eventLoopDelay' && s.max >= 100)
    strictEqual(typeof signal.max, 'number')
    strictEqual(typeof signal.mean, 'number')
    strictEqual(typeof signal.p99, 'number')
    strictEqual(typeof signal.timestamp, 'number')
    ok(signal.max < 60000, 'The reported delay should be plausible')
    ok(signal.p99 <= signal.max, 'The p99 cannot exceed the max')

    // The health event exposes the maximum delay (and the worst per-second
    // p99) observed over the check window
    while (true) {
      const [health] = await once(app, 'application:worker:health')

      if (health.application === 'main' && health.eventLoopDelay >= 100) {
        strictEqual(typeof health.eventLoopDelayP99, 'number')
        ok(health.eventLoopDelayP99 <= health.eventLoopDelay, 'The p99 cannot exceed the max')
        strictEqual(health.unhealthy, false, 'The worker should stay healthy below maxEventLoopDelay')
        break
      }
    }

    await request(`${url}/stall/stop`, { method: 'POST' })
  }
)

test(
  'a worker exceeding maxEventLoopDelay is marked unhealthy and replaced',
  { skip: isWindows && 'Skipping on Windows' },
  async t => {
    const configFile = join(fixturesDir, 'event-loop-delay', 'platformatic-restart.json')
    const app = await createRuntime(configFile)

    t.after(async () => {
      await app.close()
    })

    const { 'main:0': url } = await app.start()

    // 300ms blocks every 500ms: ELU stays around 0.6 (below the 0.99 maxELU
    // default) but the event loop delay exceeds the configured 100ms
    await request(`${url}/stall/start?block=300&period=500`, { method: 'POST' })

    const [unhealthy] = await once(app, 'application:worker:unhealthy')
    strictEqual(unhealthy.application, 'main')

    // The stalling worker is replaced: the interval dies with it, so the
    // replacement stays healthy
    while (true) {
      const [started] = await once(app, 'application:worker:started')

      if (started.application === 'main') {
        ok(started.worker !== 0, 'The replacement worker should have a fresh index')
        break
      }
    }
  }
)

test(
  'a worker exceeding maxEventLoopDelayP99 is marked unhealthy and replaced',
  { skip: isWindows && 'Skipping on Windows' },
  async t => {
    const configFile = join(fixturesDir, 'event-loop-delay', 'platformatic-restart-p99.json')
    const app = await createRuntime(configFile)

    t.after(async () => {
      await app.close()
    })

    const { 'main:0': url } = await app.start()

    // The p99-only threshold also activates the in-worker sampler. 300ms
    // blocks every 500ms make the per-second p99 track the stall magnitude,
    // well above the configured 100ms.
    await request(`${url}/stall/start?block=300&period=500`, { method: 'POST' })

    const [unhealthy] = await once(app, 'application:worker:unhealthy')
    strictEqual(unhealthy.application, 'main')

    while (true) {
      const [started] = await once(app, 'application:worker:started')

      if (started.application === 'main') {
        ok(started.worker !== 0, 'The replacement worker should have a fresh index')
        break
      }
    }
  }
)

test(
  'the event loop delay is not sampled when maxEventLoopDelay is not configured',
  { skip: isWindows && 'Skipping on Windows' },
  async t => {
    const configFile = join(fixturesDir, 'event-loop-delay', 'platformatic-disabled.json')
    const app = await createRuntime(configFile)

    t.after(async () => {
      await app.close()
    })

    const { 'main:0': url } = await app.start()

    await request(`${url}/stall/start?block=200&period=400`, { method: 'POST' })

    // Observe the health metrics for a few seconds: no eventLoopDelay signal
    // must ever appear
    const deadline = Date.now() + 3500
    while (Date.now() < deadline) {
      const [metric] = await once(app, 'application:worker:health:metrics')

      if (metric.application === 'main') {
        strictEqual(
          metric.healthSignals.some(s => s.type === 'eventLoopDelay'),
          false,
          'No eventLoopDelay signal should be reported when disabled'
        )
      }
    }

    await request(`${url}/stall/stop`, { method: 'POST' })
  }
)
