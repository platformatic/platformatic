'use strict'

const { cp, symlink, writeFile } = require('node:fs/promises')
const { deepStrictEqual } = require('node:assert')
const { join, resolve, dirname } = require('node:path')
const { request } = require('undici')
const { createDirectory, safeRemove, features, withResolvers } = require('@platformatic/utils')

const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const tmpDir = resolve(__dirname, '../../tmp')

const WAIT_TIMEOUT = process.env.CI ? 10_000 : 5_000

async function prepareRuntime (t, name, dependencies) {
  const root = resolve(tmpDir, `plt-multiple-workers-${Date.now()}`)

  await createDirectory(root)
  t.after(() => safeRemove(root))

  await cp(resolve(fixturesDir, name), root, { recursive: true })

  for (const [service, deps] of Object.entries(dependencies)) {
    const depsRoot = resolve(root, service, 'node_modules/@platformatic')
    await createDirectory(depsRoot)

    for (const dep of deps) {
      await symlink(resolve(root, '../../../', dep), resolve(depsRoot, dep))
    }
  }

  if (!process.env.PLT_TESTS_VERBOSE) {
    process.env.PLT_RUNTIME_LOGGER_STDOUT ??= resolve(root, 'log.txt')
    await createDirectory(dirname(process.env.PLT_RUNTIME_LOGGER_STDOUT))
    await writeFile(process.env.PLT_RUNTIME_LOGGER_STDOUT, '', 'utf-8')
  }

  return root
}

async function verifyResponse (baseUrl, service, expectedWorker, socket, additionalChecks) {
  const res = await request(baseUrl + `/${service}/hello`)
  const json = await res.body.json()

  deepStrictEqual(res.statusCode, 200)
  deepStrictEqual(res.headers['x-plt-socket'], socket)
  deepStrictEqual(res.headers['x-plt-worker-id'], expectedWorker.toString())
  deepStrictEqual(json, { from: service })
  additionalChecks?.(res, json)
}

async function verifyInject (client, service, expectedWorker, additionalChecks) {
  const res = await client.request({ method: 'GET', path: `/api/v1/services/${service}/proxy/hello` })
  const json = await res.body.json()

  deepStrictEqual(res.statusCode, 200)
  deepStrictEqual(res.headers['x-plt-worker-id'], expectedWorker.toString())
  deepStrictEqual(json, { from: service })
  additionalChecks?.(res, json)
}

function formatEvent (event) {
  return Object.entries(event)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ')
}

function getExpectedEvents (entrypoint, workers) {
  const start = []
  const stop = []

  if (!features.node.reusePort) {
    start.push({ event: 'service:started', service: entrypoint })
    stop.push({ event: 'service:stopped', service: entrypoint })
  }

  for (const [service, count] of Object.entries(workers)) {
    if (service === entrypoint && !features.node.reusePort) {
      continue
    }

    for (let i = 0; i < count; i++) {
      start.push({ event: 'service:worker:started', service, worker: i })
      stop.push({ event: 'service:worker:stopped', service, worker: i })
    }
  }

  start.push({ event: 'started' })

  return { start, stop }
}

function waitForEvents (app, ...events) {
  const timeout = typeof events.at(-1) === 'number' ? events.pop() : WAIT_TIMEOUT

  events = events.flat(Number.POSITIVE_INFINITY)
  const missing = new Set(events.map(formatEvent))
  const received = new Set()

  const { promise, resolve, reject } = withResolvers()
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
        payload = { service: payload }
      }

      const { service, worker } = payload ?? {}
      let found = { event }

      if (service) {
        found.service = service
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

module.exports = {
  fixturesDir,
  tmpDir,
  prepareRuntime,
  verifyResponse,
  verifyInject,
  formatEvent,
  getExpectedEvents,
  waitForEvents
}
