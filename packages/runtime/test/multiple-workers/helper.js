import { createDirectory, features, safeRemove } from '@platformatic/foundation'
import { deepStrictEqual } from 'node:assert'
import { cp, symlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { request } from 'undici'

export const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')
export const tmpDir = resolve(import.meta.dirname, '../../tmp')

const WAIT_TIMEOUT = process.env.CI ? 20_000 : 10_000

export async function prepareRuntime (t, name, dependencies) {
  const root = resolve(tmpDir, `plt-multiple-workers-${Date.now()}`)

  if (process.env.PLT_TESTS_KEEP_TMP === 'true' || process.env.PLT_TESTS_PRINT_TMP === 'true') {
    process._rawDebug(`Runtime root: ${root}`)
  }

  await createDirectory(root)
  t.after(() => {
    if (process.env.PLT_TESTS_KEEP_TMP !== 'true') {
      return safeRemove(root)
    } else {
      process._rawDebug(`Keeping temporary folder: ${root}`)
    }
  })

  await cp(resolve(fixturesDir, name), root, { recursive: true })

  for (const [application, deps] of Object.entries(dependencies)) {
    const depsRoot = resolve(root, application, 'node_modules/@platformatic')
    await createDirectory(depsRoot)

    for (const dep of deps) {
      await symlink(resolve(root, '../../../', dep), resolve(depsRoot, dep))
    }
  }

  return root
}

export async function verifyInject (client, application, expectedWorker, additionalChecks) {
  const res = await client.request({ method: 'GET', path: `/api/v1/applications/${application}/proxy/hello` })
  const json = await res.body.json()

  deepStrictEqual(res.statusCode, 200)
  deepStrictEqual(res.headers['x-plt-worker-id'], expectedWorker.toString())
  deepStrictEqual(json, { from: application })
  additionalChecks?.(res, json)
}

export async function testRoundRobin (baseUrl, services) {
  // Calculate iterations needed to check all sequences at least twice
  // For a service with N workers, we need at least 2*N requests to verify 2 complete cycles
  const maxWorkerCount = Math.max(...services.map(s => s.workerCount))
  const iterations = maxWorkerCount * 2

  for (const service of services) {
    service.workers = []
    service.additionalData = []
  }

  // Collect worker IDs and additional data from multiple requests
  for (let i = 0; i < iterations; i++) {
    for (const service of services) {
      const res = await request(baseUrl + `/${service.name}/hello`)
      const json = await res.body.json()

      deepStrictEqual(res.statusCode, 200)
      deepStrictEqual(res.headers['x-plt-socket'], service.expectedSocket)
      deepStrictEqual(json, { from: service.name })

      const workerId = parseInt(res.headers['x-plt-worker-id'])
      service.workers.push(workerId)

      if (service.verifyAdditional) {
        service.verifyAdditional(res, workerId, service.additionalData)
      }
    }
  }

  // Verify round-robin pattern for each service
  for (const service of services) {
    const { workers, workerCount, name } = service

    // Verify pattern repeats every workerCount requests
    for (let i = workerCount; i < workers.length; i++) {
      deepStrictEqual(
        workers[i],
        workers[i - workerCount],
        `${name}: worker at position ${i} should match position ${i - workerCount}`
      )
    }

    // Verify all workers are used (complete coverage)
    const uniqueWorkers = new Set(workers.slice(0, workerCount))
    deepStrictEqual(uniqueWorkers.size, workerCount, `${name}: all ${workerCount} workers should be used`)

    // Verify we tested at least 2 complete cycles
    deepStrictEqual(
      workers.length >= workerCount * 2,
      true,
      `${name}: should have at least ${workerCount * 2} requests to verify 2 complete cycles`
    )
  }
}

export function formatEvent (event) {
  return Object.entries(event)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ')
}

export function getExpectedEvents (entrypoint, workers) {
  const start = []
  const stop = []

  if (!features.node.reusePort) {
    start.push({ event: 'application:started', application: entrypoint })
    stop.push({ event: 'application:stopped', application: entrypoint })
  }

  for (const [application, count] of Object.entries(workers)) {
    if (application === entrypoint && !features.node.reusePort) {
      continue
    }

    for (let i = 0; i < count; i++) {
      start.push({ event: 'application:worker:started', application, worker: i })
      stop.push({ event: 'application:worker:stopped', application, worker: i })
    }
  }

  start.push({ event: 'started' })

  return { start, stop }
}

export function waitForEvents (app, ...events) {
  const timeout = typeof events.at(-1) === 'number' ? events.pop() : WAIT_TIMEOUT

  events = events.flat(Number.POSITIVE_INFINITY)
  const missing = new Set(events.map(formatEvent))
  const received = new Set()

  const { promise, resolve, reject } = Promise.withResolvers()
  let rejected = false

  const timeoutHandle = setTimeout(() => {
    rejected = true
    reject(new Error(`Timeout waiting for events: ${Array.from(missing).join('; ')}`))
  }, timeout)

  const toListen = new Set(events.map(e => e.event))
  const listeners = []

  for (const event of toListen) {
    function listener (payload) {
      if (rejected) {
        return
      }

      if (typeof payload === 'string') {
        payload = { application: payload }
      }

      const { application, worker } = payload ?? {}
      let found = { event }

      if (application) {
        found.application = application
      }

      if (worker !== undefined) {
        found.worker = worker
      }

      found = formatEvent(found)
      missing.delete(found)
      received.add(found)

      if (missing.size === 0) {
        resolve(received)
      }
    }

    app.on(event, listener)
    listeners.push({ event, listener })
  }

  promise.finally(() => {
    clearTimeout(timeoutHandle)

    for (const { event, listener } of listeners) {
      app.off(event, listener)
    }
  })

  return promise
}
