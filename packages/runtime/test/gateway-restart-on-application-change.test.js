import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { prepareApplication } from '../index.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

// `gateway.restartOnApplicationChange` (default true).
//
// A gateway recomposes its routes by restarting itself when an application is
// added or removed. `restartApplication` replaces workers one at a time, so
// with two or more workers and SO_REUSEPORT the restart is seamless — but with
// ONE worker, which is the default and is forced wherever reusePort is
// unavailable, the listening socket closes for the length of a worker boot.
//
// For a gateway that does not route from the application registry at all, that
// restart buys nothing and costs the runtime its only open port. The option
// lets such a gateway opt out. It defaults to true, so nothing changes for a
// gateway that does compose the registry.

async function addExtraApplication (runtime) {
  return await runtime.addApplications(
    [
      await prepareApplication(runtime.getRuntimeConfig(true), {
        id: 'extra-service',
        path: './extra-service'
      })
    ],
    true
  )
}

// Drives requests through the gateway until stopped, recording every outcome.
// A restart that closes the socket shows up here as ECONNREFUSED, which is the
// symptom the option exists to remove — a status-code check alone would miss it.
function keepRequesting (url) {
  const results = { ok: 0, failures: [] }
  // A holder rather than a bare `let`: stop() flips it from outside the loop,
  // which a plain variable makes look unmodified to static analysis.
  const state = { running: true }

  const loop = (async () => {
    while (state.running) {
      try {
        const res = await request(`${url}/backend/hello`)
        await res.body.text()
        if (res.statusCode === 200) {
          results.ok++
        } else {
          results.failures.push(`HTTP ${res.statusCode}`)
        }
      } catch (err) {
        results.failures.push(err.code ?? err.message)
      }
    }
  })()

  return {
    results,
    async stop () {
      state.running = false
      await loop
    }
  }
}

test('a gateway with restartOnApplicationChange disabled keeps serving when an application is added', async t => {
  const runtime = await createRuntime(join(fixturesDir, 'gateway-no-restart-on-change'), null)
  t.after(() => runtime.close())

  const url = await runtime.start()
  const originalPort = new URL(url).port

  const restarts = []
  runtime.on('application:restarted', id => restarts.push(id))

  {
    const res = await request(`${url}/backend/hello`)
    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { from: 'backend' })
  }

  const traffic = keepRequesting(url)

  const started = once(runtime, 'application:started')
  await addExtraApplication(runtime)
  await started

  // Longer than a worker boot: a restart that was going to happen has had
  // ample time to, and the traffic loop above would have caught its window.
  await new Promise(resolve => setTimeout(resolve, 2000))
  await traffic.stop()

  strictEqual(
    restarts.filter(id => id === 'gateway').length,
    0,
    'the gateway must not restart when it has opted out of recomposing on application changes'
  )

  ok(traffic.results.ok > 0, 'the traffic loop must have made requests')
  deepStrictEqual(
    traffic.results.failures.slice(0, 5),
    [],
    `${traffic.results.failures.length} of ${traffic.results.ok + traffic.results.failures.length} requests failed while an application was added`
  )

  strictEqual(new URL(runtime.getUrl()).port, originalPort, 'the entrypoint never changed port')

  {
    const res = await request(`${runtime.getUrl()}/frontend/hello`)
    strictEqual(res.statusCode, 200, 'existing routes still work')
    deepStrictEqual(await res.body.json(), { from: 'frontend' })
  }
})

test('opting out means the new application is NOT composed until something else restarts the gateway', async t => {
  // The cost of the option, asserted rather than left implicit. Recomposing on
  // application changes is exactly what the restart is for, so a gateway that
  // opts out must be one that does not route from the registry — which is why
  // the default is true.
  const runtime = await createRuntime(join(fixturesDir, 'gateway-no-restart-on-change'), null)
  t.after(() => runtime.close())

  const url = await runtime.start()

  const started = once(runtime, 'application:started')
  await addExtraApplication(runtime)
  await started
  await new Promise(resolve => setTimeout(resolve, 2000))

  const res = await request(`${url}/extra-service/hello`)
  await res.body.text()
  strictEqual(
    res.statusCode,
    404,
    'the added application is not proxied: the gateway never recomposed, which is what opting out means'
  )

  // An explicit restart still composes it, so the option withholds the
  // automatic restart rather than breaking composition itself.
  const restarted = once(runtime, 'application:restarted')
  await runtime.restartApplication('gateway')
  await restarted

  const afterRestart = await request(`${runtime.getUrl()}/extra-service/hello`)
  strictEqual(afterRestart.statusCode, 200, 'an explicit restart composes it')
  deepStrictEqual(await afterRestart.body.json(), { from: 'extra-service' })
})

test('the default is unchanged: a gateway still restarts on an application change', async t => {
  // The guard on the default. The option is only safe to add because every
  // existing gateway keeps the behaviour it has today.
  const runtime = await createRuntime(join(fixturesDir, 'gateway-restart-port'), null)
  t.after(() => runtime.close())

  await runtime.start()

  const restarted = once(runtime, 'application:restarted')
  const started = once(runtime, 'application:started')
  await addExtraApplication(runtime)
  await started
  await restarted

  const res = await request(`${runtime.getUrl()}/extra-service/hello`)
  strictEqual(res.statusCode, 200, 'the default still composes a newly added application')
  deepStrictEqual(await res.body.json(), { from: 'extra-service' })
})
