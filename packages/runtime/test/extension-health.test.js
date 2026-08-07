import getPort from 'get-port'
import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { transform } from '../lib/config.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

function resetHealthApiState (overrides = {}) {
  globalThis.__pltExtensionHealthApi = {
    readiness: true,
    readinessResult: undefined,
    readinessThrow: false,
    readinessDelay: 0,
    readinessMalformed: false,
    liveness: true,
    livenessResult: undefined,
    livenessThrow: false,
    events: [],
    ...overrides
  }
  globalThis.__pltExtensionReadyOnly = { readiness: true }
  globalThis.__pltExtensionHealthSecond = { readiness: true, liveness: true }
}

async function startWithMetrics (t, configName, extraEnv = {}) {
  process.env.PORT = '0'
  const metricsPort = await getPort()
  process.env.METRICS_PORT = String(metricsPort)

  for (const [key, value] of Object.entries(extraEnv)) {
    process.env[key] = String(value)
  }

  const configFile = join(fixturesDir, 'extensions', configName)
  const app = await createRuntime(configFile)
  await app.start()

  t.after(async () => {
    await app.close()
  })

  return { app, metricsPort }
}

async function probe (port, path) {
  const { statusCode, body } = await request(`http://127.0.0.1:${port}${path}`)
  const text = await body.text()
  return { statusCode, text }
}

test('extension readiness and liveness success, plus custom routes on shared probe server', async t => {
  resetHealthApiState()
  const { metricsPort } = await startWithMetrics(t, 'platformatic-health-api.json')

  {
    const { statusCode, text } = await probe(metricsPort, '/ready')
    strictEqual(statusCode, 200)
    strictEqual(text, 'OK')
  }

  {
    const { statusCode, text } = await probe(metricsPort, '/status')
    strictEqual(statusCode, 200)
    strictEqual(text, 'OK')
  }

  {
    const { statusCode, body } = await request(`http://127.0.0.1:${metricsPort}/inventory`)
    strictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { ok: true, from: 'primary' })
  }
})

test('extension readiness failure fails /ready', async t => {
  resetHealthApiState({ readiness: false })
  const { metricsPort } = await startWithMetrics(t, 'platformatic-health-api.json')

  const { statusCode, text } = await probe(metricsPort, '/ready')
  strictEqual(statusCode, 500)
  strictEqual(text, 'ERR')
})

test('extension readiness rejection fails closed on /ready', async t => {
  resetHealthApiState({ readinessThrow: true })
  const { metricsPort } = await startWithMetrics(t, 'platformatic-health-api.json')

  const { statusCode, text } = await probe(metricsPort, '/ready')
  strictEqual(statusCode, 500)
  strictEqual(text, 'ERR')
})

test('extension readiness malformed result fails closed on /ready', async t => {
  resetHealthApiState({ readinessMalformed: true })
  const { metricsPort } = await startWithMetrics(t, 'platformatic-health-api.json')

  const { statusCode, text } = await probe(metricsPort, '/ready')
  strictEqual(statusCode, 500)
  strictEqual(text, 'ERR')
})

test('extension readiness timeout fails closed on /ready', async t => {
  resetHealthApiState({ readinessDelay: 200 })
  process.env.PORT = '0'
  const metricsPort = await getPort()
  process.env.METRICS_PORT = String(metricsPort)

  const configFile = join(fixturesDir, 'extensions', 'platformatic-health-api.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.metrics = {
        ...config.metrics,
        healthChecksTimeouts: 50
      }
      return config
    }
  })
  await app.start()

  t.after(async () => {
    await app.close()
  })

  const { statusCode, text } = await probe(metricsPort, '/ready')
  strictEqual(statusCode, 500)
  strictEqual(text, 'ERR')
})

test('extension readiness custom response body and status code', async t => {
  resetHealthApiState({
    readinessResult: { status: false, statusCode: 503, body: 'not-dispatchable' }
  })
  const { metricsPort } = await startWithMetrics(t, 'platformatic-health-api.json')

  const { statusCode, text } = await probe(metricsPort, '/ready')
  strictEqual(statusCode, 503)
  strictEqual(text, 'not-dispatchable')
})

test('extension liveness failure fails /status', async t => {
  resetHealthApiState({ liveness: false })
  const { metricsPort } = await startWithMetrics(t, 'platformatic-health-api.json')

  {
    const { statusCode, text } = await probe(metricsPort, '/ready')
    strictEqual(statusCode, 200)
    strictEqual(text, 'OK')
  }

  {
    const { statusCode, text } = await probe(metricsPort, '/status')
    strictEqual(statusCode, 500)
    strictEqual(text, 'ERR')
  }
})

test('readiness-only extension failure does not fail liveness', async t => {
  resetHealthApiState()
  globalThis.__pltExtensionReadyOnly = { readiness: false }
  const { metricsPort } = await startWithMetrics(t, 'platformatic-health-ready-only.json')

  {
    const { statusCode, text } = await probe(metricsPort, '/ready')
    strictEqual(statusCode, 500)
    strictEqual(text, 'ERR')
  }

  {
    const { statusCode, text } = await probe(metricsPort, '/status')
    strictEqual(statusCode, 200)
    strictEqual(text, 'OK')
  }
})

test('multiple extension checks aggregate deterministically', async t => {
  resetHealthApiState({ readiness: true, liveness: true })
  globalThis.__pltExtensionHealthSecond = { readiness: false, liveness: true }
  const { metricsPort } = await startWithMetrics(t, 'platformatic-health-multi.json')

  {
    const { statusCode, text } = await probe(metricsPort, '/ready')
    strictEqual(statusCode, 500)
    strictEqual(text, 'ERR')
  }

  globalThis.__pltExtensionHealthSecond.readiness = true
  globalThis.__pltExtensionHealthApi.liveness = false
  globalThis.__pltExtensionHealthSecond.liveness = true

  {
    const { statusCode, text } = await probe(metricsPort, '/ready')
    strictEqual(statusCode, 200)
    strictEqual(text, 'OK')
  }

  {
    const { statusCode, text } = await probe(metricsPort, '/status')
    strictEqual(statusCode, 500)
    strictEqual(text, 'ERR')
  }
})

test('extension routes work on a separate health probes server', async t => {
  resetHealthApiState()
  process.env.PORT = '0'
  const metricsPort = await getPort()
  const healthPort = await getPort()
  process.env.METRICS_PORT = String(metricsPort)
  process.env.HEALTH_PORT = String(healthPort)

  const configFile = join(fixturesDir, 'extensions', 'platformatic-health-api-separate.json')
  const app = await createRuntime(configFile)
  await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const { statusCode } = await request(`http://127.0.0.1:${metricsPort}/inventory`)
    strictEqual(statusCode, 404)
  }

  {
    const { statusCode, body } = await request(`http://127.0.0.1:${healthPort}/inventory`)
    strictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { ok: true, from: 'primary' })
  }

  {
    const { statusCode, text } = await probe(healthPort, '/ready')
    strictEqual(statusCode, 200)
    strictEqual(text, 'OK')
  }

  {
    const { statusCode, text } = await probe(healthPort, '/status')
    strictEqual(statusCode, 200)
    strictEqual(text, 'OK')
  }
})

test('duplicate readiness check names fail startup with a coded error', async t => {
  resetHealthApiState()
  process.env.PORT = '0'

  const configFile = join(fixturesDir, 'extensions', 'platformatic-health-duplicate-check.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  await rejects(
    () => app.init(),
    err => {
      strictEqual(err.code, 'PLT_RUNTIME_FAILED_TO_LOAD_EXTENSION')
      strictEqual(err.cause.code, 'PLT_RUNTIME_DUPLICATE_EXTENSION_HEALTH_CHECK')
      ok(err.cause.message.includes('shared'))
      return true
    }
  )
})

test('duplicate readiness check names across extensions fail startup', async t => {
  resetHealthApiState()
  process.env.PORT = '0'

  const configFile = join(fixturesDir, 'extensions', 'platformatic-health-duplicate-check-multi.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  await rejects(
    () => app.init(),
    err => {
      strictEqual(err.code, 'PLT_RUNTIME_FAILED_TO_LOAD_EXTENSION')
      strictEqual(err.cause.code, 'PLT_RUNTIME_DUPLICATE_EXTENSION_HEALTH_CHECK')
      return true
    }
  )
})

test('duplicate health routes fail startup with a coded error', async t => {
  resetHealthApiState()
  process.env.PORT = '0'

  const configFile = join(fixturesDir, 'extensions', 'platformatic-health-duplicate-route.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  await rejects(
    () => app.init(),
    err => {
      strictEqual(err.code, 'PLT_RUNTIME_DUPLICATE_EXTENSION_HEALTH_ROUTE')
      ok(err.message.includes('/inventory'))
      return true
    }
  )
})

test('closing an extension removes its checks and routes', async t => {
  resetHealthApiState()
  const { metricsPort } = await startWithMetrics(t, 'platformatic-health-api.json')

  {
    const { statusCode } = await request(`http://127.0.0.1:${metricsPort}/inventory`)
    strictEqual(statusCode, 200)
  }

  // Simulate extension cleanup (as runtime close does) while the server is still up.
  const state = globalThis.__pltExtensionHealthApi
  state.unregisterReadiness()
  state.unregisterLiveness()
  state.unregisterRoutes()

  // Without extension readiness checks, workers alone keep /ready healthy.
  {
    const { statusCode, text } = await probe(metricsPort, '/ready')
    strictEqual(statusCode, 200)
    strictEqual(text, 'OK')
  }

  {
    const { statusCode } = await request(`http://127.0.0.1:${metricsPort}/inventory`)
    strictEqual(statusCode, 404)
  }
})

test('probe behavior is unchanged without extension health registrations', async t => {
  process.env.PORT = '0'
  const metricsPort = await getPort()

  const configFile = join(fixturesDir, 'extensions', 'platformatic.runtime.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.metrics = {
        hostname: '127.0.0.1',
        port: metricsPort
      }
      return config
    }
  })
  await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const { statusCode, text } = await probe(metricsPort, '/ready')
    strictEqual(statusCode, 200)
    strictEqual(text, 'OK')
  }

  {
    const { statusCode, text } = await probe(metricsPort, '/status')
    strictEqual(statusCode, 200)
    strictEqual(text, 'OK')
  }

  {
    const { statusCode } = await request(`http://127.0.0.1:${metricsPort}/inventory`)
    strictEqual(statusCode, 404)
  }
})

test('registering health routes fails when health probes are disabled', async t => {
  resetHealthApiState()
  process.env.PORT = '0'
  const metricsPort = await getPort()
  process.env.METRICS_PORT = String(metricsPort)

  const configFile = join(fixturesDir, 'extensions', 'platformatic-health-api.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.healthProbes = false
      return config
    }
  })

  t.after(async () => {
    await app.close()
  })

  await rejects(
    () => app.init(),
    err => {
      strictEqual(err.code, 'PLT_RUNTIME_EXTENSION_HEALTH_ROUTES_UNAVAILABLE')
      return true
    }
  )
})

test('partial start failure cleans up extension health contributions', async t => {
  resetHealthApiState()
  process.env.PORT = '0'
  const metricsPort = await getPort()
  process.env.METRICS_PORT = String(metricsPort)

  const configFile = join(fixturesDir, 'extensions', 'platformatic-health-api.json')
  const app = await createRuntime(configFile)
  await app.init()

  // Force a start failure after init (health routes already applied).
  app.startApplications = async () => {
    throw new Error('forced start failure')
  }

  await rejects(() => app.start(), /forced start failure/)

  // closeAndThrow already closed the runtime; health contributions must be gone.
  await sleep(10)
  ok(globalThis.__pltExtensionHealthApi.events.some(e => e.event === 'close'))
  strictEqual(app.getExtensionHealthRoutes().length, 0)
})
