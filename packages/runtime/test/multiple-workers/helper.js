import { createDirectory, features, safeRemove } from '@platformatic/foundation'
import { deepStrictEqual } from 'node:assert'
import { cp, symlink } from 'node:fs/promises'
import { createServer } from 'node:net'
import { join, resolve } from 'node:path'
import { request } from 'undici'

export const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')
export const tmpDir = resolve(import.meta.dirname, '../../tmp')

const WAIT_TIMEOUT = process.env.CI ? 20_000 : 10_000
const MAX_PORT = 65_535
const MIN_WINDOWS_TEST_PORT = 1_024
const WINDOWS_DYNAMIC_PORT_START = 49_152

function getCandidatePort (size) {
  if (process.platform !== 'win32') {
    return 0
  }

  // Windows can add excluded ranges while the runner is active. Those ranges
  // normally live in the dynamic port range and fail with EACCES when bound.
  // Pick a random non-dynamic port so the range remains usable after probing.
  const maxBasePort = WINDOWS_DYNAMIC_PORT_START - size
  if (maxBasePort < MIN_WINDOWS_TEST_PORT) {
    return 0
  }

  return MIN_WINDOWS_TEST_PORT + Math.floor(Math.random() * (maxBasePort - MIN_WINDOWS_TEST_PORT + 1))
}

function listen (server, host, port) {
  return new Promise((resolve, reject) => {
    function onError (error) {
      server.off('listening', onListening)
      reject(error)
    }

    function onListening () {
      server.off('error', onError)
      resolve()
    }

    server.once('error', onError)
    server.once('listening', onListening)
    server.listen({ host, port, exclusive: true })
  })
}

function closeServer (server) {
  if (!server.listening) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()))
  })
}

export async function findAvailablePortRange ({ host, size, startPort }) {
  if (!Number.isInteger(size) || size < 1 || size > MAX_PORT) {
    throw new RangeError('size must be an integer between 1 and 65535')
  }

  if (startPort !== undefined && (!Number.isInteger(startPort) || startPort < 1 || startPort > MAX_PORT)) {
    throw new RangeError('startPort must be an integer between 1 and 65535')
  }

  while (true) {
    const servers = []

    try {
      const firstServer = createServer()
      servers.push(firstServer)
      await listen(firstServer, host, startPort ?? getCandidatePort(size))
      startPort = undefined

      const address = firstServer.address()
      const basePort = address.port

      if (basePort + size - 1 > MAX_PORT) {
        continue
      }

      for (let offset = 1; offset < size; offset++) {
        const server = createServer()
        servers.push(server)
        await listen(server, host, basePort + offset)
      }

      return basePort
    } catch (error) {
      startPort = undefined

      if (error.code !== 'EACCES' && error.code !== 'EADDRINUSE') {
        throw error
      }
    } finally {
      await Promise.all(servers.map(closeServer))
    }
  }
}

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

// Right after startup the mesh routes might not be fully registered yet and
// requests can get a 404: wait for every service to be reachable first. The
// warm up requests do not affect the round robin verification, which is
// insensitive to the starting worker.
async function waitForServices (baseUrl, services, { timeoutMs = WAIT_TIMEOUT, intervalMs = 250 } = {}) {
  const start = Date.now()

  for (const service of services) {
    while (true) {
      try {
        const res = await request(baseUrl + `/${service.name}/hello`)
        await res.body.dump()
        if (res.statusCode === 200) {
          break
        }
      } catch {}

      if (Date.now() - start > timeoutMs) {
        break
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }
}

export async function testRoundRobin (baseUrl, services) {
  await waitForServices(baseUrl, services)

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

export function getExpectedEvents (workers) {
  const start = []
  const stop = []

  if (!features.node.reusePort) {
    for (const application of Object.keys(workers)) {
      start.push({ event: 'application:started', application })
      stop.push({ event: 'application:stopped', application })
    }
  }

  for (const [application, count] of Object.entries(workers)) {
    if (!features.node.reusePort) {
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
