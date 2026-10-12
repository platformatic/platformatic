import { ITC } from '@platformatic/itc'
import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { createRuntime, updateConfigFile } from '../helpers.js'
import { findAvailablePortRange, prepareRuntime, waitForEvents } from './helper.js'

// Long enough to act on the runtime while a crashed worker waits to be restarted
const RESTART_ON_ERROR = 1000

async function prepareCrashableRuntime (t, { workers, workersRestartDelay, perWorkerPortRange, entrypoint } = {}) {
  const root = await prepareRuntime(t, 'crash-restart-state', { node: ['node'] })
  const configFile = join(root, 'platformatic.json')
  let basePort

  if (perWorkerPortRange) {
    basePort = await findAvailablePortRange({ host: '127.0.0.1', size: perWorkerPortRange })
  }

  await updateConfigFile(configFile, config => {
    config.restartOnError = RESTART_ON_ERROR
    config.services[0].workers = workers

    if (workersRestartDelay) {
      config.workersRestartDelay = workersRestartDelay
    }

    if (basePort) {
      config.server = { ...config.server, port: basePort, portAssignment: 'perWorkerIncrement' }
    }

    // A separate entrypoint, so that the application under test can be removed
    if (entrypoint) {
      config.services.push({ id: entrypoint, path: './node', config: 'platformatic.json' })
      config.entrypoint = entrypoint
    }
  })

  const runtime = await createRuntime(configFile)
  t.after(() => runtime.close())
  await runtime.start()

  return { runtime, basePort }
}

async function getNodeWorkers (runtime) {
  return Object.values(await runtime.getWorkers()).filter(worker => worker.application === 'node')
}

// Keeps sending the crashing request until the round robin routes it to the targeted worker
async function crashWorker (runtime, worker) {
  const exited = waitForEvents(runtime, { event: 'application:worker:exited', application: 'node', worker })

  try {
    for (let attempt = 0; attempt < 20; attempt++) {
      const res = await runtime.inject('node', { method: 'GET', url: `/crash?worker=${worker}` })

      if (res.statusCode === 200) {
        await exited
        return
      }
    }
  } catch (err) {
    exited.catch(() => {})
    throw err
  }

  exited.catch(() => {})
  throw new Error(`Unable to route the crashing request to the worker ${worker}.`)
}

// Gives a pending crash restart the time to happen, then waits for every worker to complete its transition
async function settleWorkers (runtime) {
  await sleep(RESTART_ON_ERROR * 2)
  const deadline = Date.now() + 10_000

  while (true) {
    const workers = await getNodeWorkers(runtime)

    if (workers.every(worker => worker.status === 'started') || Date.now() > deadline) {
      return workers
    }

    await sleep(100)
  }
}

async function assertServingWorkers (runtime, expected) {
  const workers = await settleWorkers(runtime)

  deepStrictEqual(workers.map(worker => worker.status), Array(expected).fill('started'))
  strictEqual((await runtime.getApplicationResourcesInfo('node')).workers, expected)

  if (expected > 0) {
    const res = await runtime.inject('node', { method: 'GET', url: '/hello' })
    strictEqual(res.statusCode, 200)
    deepStrictEqual(JSON.parse(res.payload), { from: 'node' })
  }

  return workers
}

function withTimeout (promise, timeout, message) {
  return Promise.race([
    promise,
    sleep(timeout, undefined, { ref: false }).then(() => {
      throw new Error(message)
    })
  ])
}

test('a scale-up requested while a crashed worker waits to be restarted does not overshoot', async t => {
  const { runtime } = await prepareCrashableRuntime(t, { workers: 2 })

  await crashWorker(runtime, 0)
  // The autoscaler reacts to the load moving onto the surviving worker
  await runtime.updateApplicationsResources([{ application: 'node', workers: 3 }])

  await assertServingWorkers(runtime, 3)
})

test('a scale-down requested while a crashed worker waits to be restarted is honored', async t => {
  const { runtime } = await prepareCrashableRuntime(t, { workers: 3 })

  await crashWorker(runtime, 0)
  // The autoscaler sees the traffic dropping and removes a worker
  await runtime.updateApplicationsResources([{ application: 'node', workers: 2 }])

  await assertServingWorkers(runtime, 2)
})

test('stopping an application while a crashed worker waits to be restarted keeps it stopped', async t => {
  const { runtime } = await prepareCrashableRuntime(t, { workers: 2 })

  await crashWorker(runtime, 0)
  // An operator stops the crashing application to investigate
  await runtime.stopApplication('node')

  const started = []
  runtime.on('application:worker:started', ({ application, worker }) => {
    if (application === 'node') started.push(worker)
  })

  await assertServingWorkers(runtime, 0)
  deepStrictEqual(started, [], 'no worker should be started for a stopped application')

  // Once the investigation is over, the application comes back with its configured workers
  await runtime.startApplication('node')
  await assertServingWorkers(runtime, 2)
})

test('removing an application while a crashed worker waits to be restarted does not resurrect it', async t => {
  const { runtime } = await prepareCrashableRuntime(t, { workers: 2, entrypoint: 'entry' })

  await crashWorker(runtime, 0)
  // The control plane undeploys the crashing application
  await runtime.removeApplications(['node'])

  await sleep(RESTART_ON_ERROR * 2)
  deepStrictEqual(await getNodeWorkers(runtime), [])
})

test('a rolling restart completes when a worker crashes before being replaced', { timeout: 60_000 }, async t => {
  // Gradual rollout: leave time between replacements, which is when the crash happens
  const { runtime } = await prepareCrashableRuntime(t, { workers: 2, workersRestartDelay: 1000 })
  const originalWorkers = (await getNodeWorkers(runtime)).map(worker => Number(worker.worker))

  let crash
  runtime.on('application:worker:started', ({ application, worker }) => {
    if (application === 'node' && !crash && !originalWorkers.includes(worker)) {
      crash = crashWorker(runtime, originalWorkers[1])
    }
  })

  await withTimeout(runtime.restartApplication('node'), 20_000, 'The restart did not complete.')
  await crash

  await assertServingWorkers(runtime, 2)
})

test('a rolling restart completes when the worker being replaced crashes', { timeout: 60_000 }, async t => {
  const { runtime } = await prepareCrashableRuntime(t, { workers: 1 })
  const [originalWorker] = (await getNodeWorkers(runtime)).map(worker => Number(worker.worker))

  // Simulates a slow-booting replacement: it only starts once the original worker has crashed
  const originalCrashed = Promise.withResolvers()
  const send = ITC.prototype.send
  t.mock.method(ITC.prototype, 'send', async function (name, ...args) {
    if (name === 'start') {
      await originalCrashed.promise
    }

    return send.call(this, name, ...args)
  })

  // The replacement is not in the mesh until started, so the crashing request reaches the original worker
  let crash
  runtime.once('application:worker:starting', () => {
    crash = crashWorker(runtime, originalWorker).then(originalCrashed.resolve, originalCrashed.reject)
  })

  await withTimeout(runtime.restartApplication('node'), 20_000, 'The restart did not complete.')
  await crash

  await assertServingWorkers(runtime, 1)

  // A later deploy must still be able to restart the application
  const restarted = waitForEvents(runtime, { event: 'application:restarted', application: 'node' })
  await runtime.restartApplication('node')
  await restarted
})

test('workers keep distinct ports when scaling up while a crashed worker waits to be restarted', async t => {
  const { runtime, basePort } = await prepareCrashableRuntime(t, { workers: 2, perWorkerPortRange: 4 })

  await crashWorker(runtime, 0)
  await runtime.updateApplicationsResources([{ application: 'node', workers: 3 }])

  const workers = await assertServingWorkers(runtime, 3)

  // Round robin over all the workers twice to collect the port of each of them
  const ports = new Map()
  for (let i = 0; i < workers.length * 2; i++) {
    const res = await runtime.inject('node', { method: 'GET', url: '/hello' })
    ports.set(res.headers['x-plt-worker-id'], Number(res.headers['x-plt-port']))
  }

  deepStrictEqual(
    [...ports.values()].sort((a, b) => a - b),
    [basePort, basePort + 1, basePort + 2]
  )
})
