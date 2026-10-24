import { features } from '@platformatic/foundation'
import { deepStrictEqual, notStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { resolve, join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { configurationFileIn, createRuntime, updateConfigFile } from '../helpers.js'
import { findAvailablePortRange, prepareRuntime, waitForEvents } from './helper.js'

const HOST = '127.0.0.1'
const WINDOWS_DYNAMIC_PORT_START = 49_152
const NO_REUSE_PORT = !features.node.reusePort && 'reusePort is not available on this platform'

async function listen (server, port = 0) {
  server.listen({ host: HOST, port, exclusive: true })
  await once(server, 'listening')
}

function closeServer (server) {
  if (!server.listening) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()))
  })
}

async function getOccupiedPortWithAvailablePreviousPort () {
  while (true) {
    const occupiedServer = createServer()
    await listen(occupiedServer)
    const occupiedPort = occupiedServer.address().port
    const candidatePort = occupiedPort - 1
    const probeServer = createServer()

    try {
      await listen(probeServer, candidatePort)
      return { candidatePort, occupiedPort, occupiedServer }
    } catch {
      await closeServer(occupiedServer)
    } finally {
      await closeServer(probeServer)
    }
  }
}

// Configures the application to use per-worker port assignment, starting from a free range of ports.
// The port assignment lives in the capability configuration since ports are per-application.
async function preparePerWorkerPortRuntime (
  t,
  {
    application = 'node',
    workerCount = 5,
    maxWorkerCount = workerCount,
    additionalApplications = [],
    beforeCreate,
    health
  } = {}
) {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = configurationFileIn(root)
  const basePort = await findAvailablePortRange({ host: HOST, size: maxWorkerCount })

  await updateConfigFile(configurationFileIn(join(root, application)), contents => {
    contents.server = {
      ...contents.server,
      hostname: HOST,
      port: basePort,
      portAssignment: 'perWorkerIncrement'
    }
  })

  await updateConfigFile(configFile, contents => {
    contents.autoload = undefined
    contents.metrics = false

    if (health) {
      contents.health = health
    }

    let applicationConfig = contents.applications.find(service => service.id === application)
    if (!applicationConfig) {
      applicationConfig = {
        id: application,
        path: `./${application}`
      }
      contents.applications.push(applicationConfig)
    }

    applicationConfig.workers = workerCount

    for (const additional of additionalApplications) {
      contents.applications.push(additional)
    }
  })

  if (application === 'service') {
    await updateConfigFile(configurationFileIn(resolve(root, 'service')), contents => {
      contents.plugins.paths.push('./crash-plugin.js')
    })
  }

  /*
    Every configuration is evaluated once, when the runtime is loaded, so a test that wants a file
    to say something different has to say it before this point -- editing it afterwards is a change
    to a file nothing will read again.
  */
  await beforeCreate?.({ root, basePort })

  const app = await createRuntime(configFile, null, { isProduction: true })

  t.after(async () => {
    await app.close()
  })

  return { app, basePort, root }
}

async function requestWorkerPort (port, expectedFrom = 'node') {
  const res = await request(`http://${HOST}:${port}/hello`, {
    headersTimeout: 2000,
    bodyTimeout: 2000
  })
  const json = await res.body.json()

  strictEqual(res.statusCode, 200)
  strictEqual(json.from, expectedFrom)
  strictEqual(res.headers['x-plt-port'], port.toString())

  return Number(res.headers['x-plt-worker-id'])
}

async function assertPortsRespond (basePort, offsets, expectedFrom = 'node') {
  const workerIds = []

  for (const offset of offsets) {
    workerIds.push(await requestWorkerPort(basePort + offset, expectedFrom))
  }

  return workerIds
}

async function waitForWorkerOnPort (port, expectedWorkerId, expectedFrom = 'node', attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const workerId = await requestWorkerPort(port, expectedFrom)
      if (workerId === expectedWorkerId) {
        return workerId
      }
    } catch {}

    await sleep(100)
  }

  throw new Error(`Port ${port} did not switch to worker ${expectedWorkerId}`)
}

// Drives requests to each port until stopped, recording every failure.
// When a worker is replaced, a closed listening socket shows up here as ECONNREFUSED.
// An ECONNRESET is expected instead when the old worker closes its idle keep-alive sockets,
// or resets the connections still queued on its listener (unless net.ipv4.tcp_migrate_req is set).
function keepRequesting (ports) {
  const results = { ok: 0, failures: [] }
  // A holder rather than a bare `let`: stop() flips it from outside the loops,
  // which a plain variable makes look unmodified to static analysis.
  const state = { running: true }

  const loops = ports.map(async port => {
    while (state.running) {
      try {
        const res = await request(`http://${HOST}:${port}/hello`)
        await res.body.text()
        if (res.statusCode === 200) {
          results.ok++
        } else {
          results.failures.push(`${port}: HTTP ${res.statusCode}`)
        }
      } catch (err) {
        results.failures.push(`${port}: ${err.code ?? err.message}`)
      }

      // Throttle so the polling alone does not push the workers over maxELU
      await sleep(20)
    }
  })

  return {
    results,
    refused () {
      return results.failures.filter(failure => failure.endsWith(': ECONNREFUSED'))
    },
    async stop () {
      state.running = false
      await Promise.all(loops)
    }
  }
}

async function assertPortClosed (port) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const res = await request(`http://${HOST}:${port}/hello`, {
        headersTimeout: 200,
        bodyTimeout: 200
      })
      await res.body.text()
    } catch {
      return
    }

    await sleep(100)
  }

  throw new Error(`Port ${port} is still accepting requests`)
}

test('findAvailablePortRange retries when a port inside the candidate range is unavailable', async t => {
  const { candidatePort, occupiedServer } = await getOccupiedPortWithAvailablePreviousPort()
  t.after(() => closeServer(occupiedServer))

  const basePort = await findAvailablePortRange({ host: HOST, size: 2, startPort: candidatePort })
  notStrictEqual(basePort, candidatePort)

  const probeServers = []
  try {
    for (let offset = 0; offset < 2; offset++) {
      const server = createServer()
      probeServers.push(server)
      await listen(server, basePort + offset)
    }
  } finally {
    await Promise.all(probeServers.map(closeServer))
  }

  const candidateServer = createServer()
  try {
    await listen(candidateServer, candidatePort)
  } finally {
    await closeServer(candidateServer)
  }
})

test(
  'findAvailablePortRange avoids the Windows dynamic port range',
  { skip: process.platform !== 'win32' },
  async () => {
    const size = 2
    const basePort = await findAvailablePortRange({ host: HOST, size })

    strictEqual(basePort + size <= WINDOWS_DYNAMIC_PORT_START, true)
  }
)

test('assigns one incremental port per worker of the application', async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t)

  const urls = await app.start()

  for (let offset = 0; offset < 5; offset++) {
    strictEqual(await requestWorkerPort(basePort + offset), offset)
    strictEqual(new URL(urls[`node:${offset}`]).port, String(basePort + offset))
  }

  deepStrictEqual(Object.keys(app.getUrls('node')).sort(), ['node:0', 'node:1', 'node:2', 'node:3', 'node:4'])

  const details = await app.getApplicationDetails('node')
  strictEqual(details.urls.length, 5)
  strictEqual(details.url, urls['node:0'])
})

test('assigns one incremental port per worker of a service application', async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t, { application: 'service', workerCount: 3 })

  await app.start()

  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2], 'service'), [0, 1, 2])
})

test('assigns new incremental ports when scaling up and stops highest ports when scaling down', async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t, { maxWorkerCount: 7 })

  await app.start()

  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [0, 1, 2, 3, 4])

  let report = await app.updateApplicationsResources([{ application: 'node', workers: 7 }])
  strictEqual(report.length, 1)
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4, 5, 6]), [0, 1, 2, 3, 4, 5, 6])

  report = await app.updateApplicationsResources([{ application: 'node', workers: 3 }])
  strictEqual(report.length, 1)
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2]), [0, 1, 2])

  await assertPortClosed(basePort + 3)
  await assertPortClosed(basePort + 4)
  await assertPortClosed(basePort + 5)
  await assertPortClosed(basePort + 6)

  // Scaling up again reuses the lowest free ports
  report = await app.updateApplicationsResources([{ application: 'node', workers: 5 }])
  strictEqual(report.length, 1)
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [0, 1, 2, 7, 8])
})

test('preserves incremental ports when restarting an application', async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t)

  await app.start()
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [0, 1, 2, 3, 4])

  await app.restartApplication('node')

  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [5, 6, 7, 8, 9])
})

test('preserves incremental ports when stopping and starting an application', async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t)

  await app.start()
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [0, 1, 2, 3, 4])

  await app.stopApplication('node')

  for (let offset = 0; offset < 5; offset++) {
    await assertPortClosed(basePort + offset)
  }

  await app.startApplication('node')
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [0, 1, 2, 3, 4])
})

test('preserves incremental ports when replacing workers after a health update', async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t)

  await app.start()
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [0, 1, 2, 3, 4])

  await app.updateApplicationsResources([
    {
      application: 'node',
      workers: 5,
      health: { maxHeapTotal: '512MB' }
    }
  ])

  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [5, 6, 7, 8, 9])
})

test('preserves incremental port when restarting a crashed worker', async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t, { application: 'service', workerCount: 3 })

  await app.start()
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2], 'service'), [0, 1, 2])

  const eventsPromise = waitForEvents(
    app,
    { event: 'application:worker:error', application: 'service', worker: 0 },
    20_000
  )

  const res = await request(`http://${HOST}:${basePort}/crash`, { method: 'POST' })
  await res.body.text()
  await eventsPromise

  await waitForWorkerOnPort(basePort, 3, 'service')
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2], 'service'), [3, 1, 2])

  // Crash the replacement worker as well: the new worker must inherit the port offset, not use its index
  const secondEventsPromise = waitForEvents(
    app,
    { event: 'application:worker:error', application: 'service', worker: 3 },
    20_000
  )

  const secondRes = await request(`http://${HOST}:${basePort}/crash`, { method: 'POST' })
  await secondRes.body.text()
  await secondEventsPromise

  await waitForWorkerOnPort(basePort, 4, 'service')
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2], 'service'), [4, 1, 2])
})

test('rejects another application listening on a port used by one of the workers', async t => {
  // The service is set to the port node's second worker will take, and set before the runtime is
  // created -- every configuration is evaluated once, at load. So the overlap is declared, and the
  // load time check rejects it when the configuration loads, earlier than the start time check and
  // naming both applications and the range they collide on.
  await rejects(
    () =>
      preparePerWorkerPortRuntime(t, {
        workerCount: 3,
        additionalApplications: [{ id: 'service', path: './service', workers: 1 }],
        async beforeCreate ({ root, basePort }) {
          await updateConfigFile(configurationFileIn(resolve(root, 'service')), contents => {
            contents.server = { ...contents.server, hostname: HOST, port: basePort + 1 }
          })
        }
      }),
    error => {
      strictEqual(error.code, 'PLT_RUNTIME_APPLICATIONS_PORTS_OVERLAP')
      ok(error.message.includes('"node"') && error.message.includes('"service"'), error.message)
      return true
    }
  )
})

test('preserves incremental port when replacing a worker with a high ELU', async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t, {
    workerCount: 3,
    health: { enabled: true, gracePeriod: 500, interval: 500, maxELU: 0.5, maxUnhealthyChecks: 2 }
  })

  await app.start()
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2]), [0, 1, 2])

  const eventsPromise = waitForEvents(
    app,
    { event: 'application:worker:unhealthy', application: 'node', worker: 1 },
    20_000
  )

  const res = await request(`http://${HOST}:${basePort + 1}/busy`, { method: 'POST' })
  await res.body.text()
  await eventsPromise

  // Without reusePort the busy worker is stopped before its replacement starts, which can take a while
  await waitForWorkerOnPort(basePort + 1, 3, 'node', 300)
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2]), [0, 3, 2])
})

test('keeps every incremental port open while restarting an application', { skip: NO_REUSE_PORT }, async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t)

  await app.start()
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [0, 1, 2, 3, 4])

  const requester = keepRequesting([0, 1, 2, 3, 4].map(offset => basePort + offset))
  await app.restartApplication('node')
  await requester.stop()

  deepStrictEqual(requester.refused(), [])
  ok(requester.results.ok > 0)
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [5, 6, 7, 8, 9])
})

test('keeps the incremental port open while replacing a worker with a high ELU', { skip: NO_REUSE_PORT }, async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t, {
    workerCount: 3,
    health: { enabled: true, gracePeriod: 500, interval: 500, maxELU: 0.5, maxUnhealthyChecks: 2 }
  })

  await app.start()
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2]), [0, 1, 2])

  // The replacement is complete once the old worker has stopped
  const eventsPromise = waitForEvents(
    app,
    [
      { event: 'application:worker:unhealthy', application: 'node', worker: 1 },
      { event: 'application:worker:started', application: 'node', worker: 3 },
      { event: 'application:worker:stopped', application: 'node', worker: 1 }
    ],
    30_000
  )

  const unhealthy = []
  app.on('application:worker:unhealthy', ({ worker }) => unhealthy.push(worker))

  const requester = keepRequesting([basePort + 1])
  const res = await request(`http://${HOST}:${basePort + 1}/busy`, { method: 'POST' })
  await res.body.text()
  await eventsPromise
  await requester.stop()

  deepStrictEqual(requester.refused(), [])
  ok(requester.results.ok > 0)
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2]), [0, 3, 2], `unhealthy workers: ${unhealthy}`)
  deepStrictEqual(unhealthy, [1])
})
