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

  if (process.env.PLT_TESTS_KEEP_TMP) {
    process._rawDebug('Runtime root:', resolve(root))
  }

  await createDirectory(root)
  t.after(() => {
    if (!process.env.PLT_TESTS_KEEP_TMP) {
      return safeRemove(root)
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

export async function verifyResponse (baseUrl, application, expectedWorker, socket, additionalChecks) {
  const res = await request(baseUrl + `/${application}/hello`)
  const json = await res.body.json()

  deepStrictEqual(res.statusCode, 200)
  deepStrictEqual(res.headers['x-plt-socket'], socket)
  deepStrictEqual(res.headers['x-plt-worker-id'], expectedWorker.toString())
  deepStrictEqual(json, { from: application })
  additionalChecks?.(res, json)
}

export async function verifyInject (client, application, expectedWorker, additionalChecks) {
  const res = await client.request({ method: 'GET', path: `/api/v1/applications/${application}/proxy/hello` })
  const json = await res.body.json()

  deepStrictEqual(res.statusCode, 200)
  deepStrictEqual(res.headers['x-plt-worker-id'], expectedWorker.toString())
  deepStrictEqual(json, { from: application })
  additionalChecks?.(res, json)
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
