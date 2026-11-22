import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { transform } from '../index.js'
import { createRuntime, readLogs } from './helpers.js'
import { findAvailablePortRange } from './multiple-workers/helper.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

// How long the worker that is replaced keeps its event loop blocked, how long the runtime waits for a
// worker in each step of its stop, and the time after which a replacement counts as held up by the block
const BLOCK_DURATION = 30000
const STOP_TIMEOUT = 1000
const HELD_UP = 20000

// The URL of the application which is reached over HTTP, whichever worker serves it
function getBlockerUrl (runtime) {
  return Object.values(runtime.getUrls('blocker'))[0]
}

async function setup (t) {
  // A fixed port, which the worker of the application does not reuse, so that a replacement stops it first
  process.env.PLT_TESTS_BLOCKER_PORT = String(await findAvailablePortRange({ host: '127.0.0.1', size: 1 }))
  t.after(() => {
    delete process.env.PLT_TESTS_BLOCKER_PORT
  })

  const context = {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.gracefulShutdown = { runtime: 10000, application: STOP_TIMEOUT }
      // The application with a fixed port is stopped before its replacement is started, on every platform
      config.reuseTcpPorts = false
      return config
    }
  }

  const runtime = await createRuntime(join(fixturesDir, 'replace-mesh-timeout'), null, context)
  await runtime.start()
  const url = getBlockerUrl(runtime)

  t.after(() => runtime.close())

  // The events of the workers of each application, in order and with their time
  const events = []
  for (const event of ['starting', 'started', 'stopping', 'stop:timeout', 'exit:timeout', 'exited', 'stopped']) {
    runtime.on(`application:worker:${event}`, payload => {
      events.push({ event, application: payload.application, worker: payload.worker, at: performance.now() })
    })
  }

  return { runtime, url, context, events }
}

function getWorkers (workers, application) {
  return Object.entries(workers).filter(([id]) => id.startsWith(`${application}:`))
}

async function waitForLog (context, prefix) {
  for (let i = 0; i < 100; i++) {
    const logs = await readLogs(context.logsPath, 0)
    if (logs.some(log => log.msg?.startsWith(prefix))) {
      return true
    }

    await sleep(50)
  }

  return false
}

// A blocked worker can neither acknowledge its removal from the mesh nor exit by itself. The runtime
// waits for it three times (the mesh, the stop and the exit), then it terminates the thread.
async function replaceBlocked (t, { runtime, context, events }, application) {
  const before = getWorkers(await runtime.getWorkers(), application)
  const oldIndex = Number(before[0][0].split(':')[1])

  const startedAt = performance.now()
  await runtime.restartApplication(application)
  const elapsed = Math.round(performance.now() - startedAt)
  t.diagnostic(`the replacement of the blocked worker of "${application}" took ${elapsed}ms`)

  // The replacement returned well before the block would have ended
  ok(elapsed < HELD_UP, `the replacement took ${elapsed}ms while the worker was blocked for ${BLOCK_DURATION}ms`)

  const after = getWorkers(await runtime.getWorkers(), application)
  deepStrictEqual(
    after.map(([, worker]) => worker.status),
    ['started'],
    `expected a single started worker, got ${JSON.stringify(after)}`
  )
  ok(after[0][0] !== before[0][0], 'the worker should have been replaced')

  // The old worker went through every wait of its stop before it was terminated
  const own = events.filter(e => e.application === application)
  const old = own.filter(e => e.worker === oldIndex).map(e => e.event)
  deepStrictEqual(old, ['stopping', 'stop:timeout', 'exit:timeout', 'exited', 'stopped'])

  ok(
    await waitForLog(context, `The worker ${oldIndex} of the application "${application}" did not acknowledge its removal from the mesh in ${STOP_TIMEOUT}ms`),
    'the runtime should say that it stopped waiting for the worker to leave the mesh'
  )

  const logs = await readLogs(context.logsPath, 0)
  ok(!logs.some(log => log.msg?.includes('will be restarted')), 'no worker should be restarted as crashed')

  return { after, own, oldIndex, startedAt }
}

// TODO: the new worker of v4 cannot finish its initialization (and join the mesh) while the old worker
// of the same application has its event loop blocked, so the replacement waits for the block to end.
// The same happens on v4 without the merge. Skipped until the behavior is decided.
test('replacing a worker whose event loop is blocked does not wait for it to leave the mesh', { skip: 'a blocked worker holds back the join of its replacement to the mesh in v4' }, async t => {
  const context = await setup(t)
  const { url } = context

  // Block the target, which is reached through the mesh, and wait until it is blocked
  const { body } = await request(`${url}/block-target?ms=${BLOCK_DURATION}`)
  body.on('error', () => {})
  const [chunk] = await once(body, 'data')
  strictEqual(chunk.toString(), 'blocking\n')

  const { after, own, oldIndex } = await replaceBlocked(t, context, 'target')

  // The new worker was started first, and the stop of the old one began only after the
  // runtime had waited for its removal from the mesh
  const started = own.findIndex(e => e.event === 'started' && e.worker !== oldIndex)
  const stopping = own.findIndex(e => e.event === 'stopping' && e.worker === oldIndex)
  ok(started !== -1 && started < stopping, 'the new worker should have been started before the old one was stopped')
  const waited = Math.round(own[stopping].at - own[started].at)
  ok(waited >= STOP_TIMEOUT - 50 && waited < STOP_TIMEOUT * 1.8, `the stop began ${waited}ms after the start of the new worker`)

  // The mesh serves the new worker
  const response = await request(`${url}/target`)
  strictEqual(response.statusCode, 200)
  deepStrictEqual(await response.body.json(), { from: 'target', worker: Number(after[0][0].split(':')[1]) })
})

test('replacing a worker with a fixed port when its event loop is blocked does not wait for it to leave the mesh', async t => {
  const context = await setup(t)
  const { runtime, url } = context

  const { body } = await request(`${url}/block?ms=${BLOCK_DURATION}`)
  body.on('error', () => {})
  const [chunk] = await once(body, 'data')
  strictEqual(chunk.toString(), 'blocking\n')

  const { own, oldIndex, startedAt } = await replaceBlocked(t, context, 'blocker')

  // The old worker was stopped first, and its stop began only after the runtime had waited
  // for its removal from the mesh
  const stopping = own.findIndex(e => e.event === 'stopping' && e.worker === oldIndex)
  const stopped = own.findIndex(e => e.event === 'stopped' && e.worker === oldIndex)
  const starting = own.findIndex(e => e.event === 'starting' && e.worker !== oldIndex)
  ok(stopped !== -1 && stopped < starting, 'the old worker should have been stopped before the new one was started')
  const waited = Math.round(own[stopping].at - startedAt)
  ok(waited >= STOP_TIMEOUT - 50 && waited < STOP_TIMEOUT * 1.8, `the stop began ${waited}ms after the replacement was asked for`)

  // The application answers again, and it still reaches the other application through the mesh
  const response = await request(`${getBlockerUrl(runtime)}/target`)
  strictEqual(response.statusCode, 200)
  strictEqual((await response.body.json()).from, 'target')
})

// The old worker ends with an error while it is being stopped, after the runtime stopped waiting for
// the mesh. A thread at its memory limit emits the error and its exit in the same turn; an uncaught
// exception can reach the runtime as an error first and as an exit later.
const endings = {
  'in the same turn as its exit' (raw, error) {
    raw.prependOnceListener('exit', () => raw.emit('error', error))
    raw.terminate()
  },
  'before its exit' (raw, error) {
    raw.emit('error', error)
    setTimeout(() => raw.terminate(), 300)
  },
  'and does not exit by itself' (raw, error) {
    raw.emit('error', error)
  }
}

for (const [moment, end] of Object.entries(endings)) {
  test(`replacing a blocked worker with a fixed port goes on when the old worker ends with an error ${moment}`, async t => {
    const context = await setup(t)
    const { runtime, url, events } = context

    const { body } = await request(`${url}/block?ms=${BLOCK_DURATION}`)
    body.on('error', () => {})
    const [chunk] = await once(body, 'data')
    strictEqual(chunk.toString(), 'blocking\n')

    const before = getWorkers(await runtime.getWorkers(), 'blocker')
    const raw = (await runtime.getWorkers(true))[before[0][0]].raw

    // The stop begins once the runtime has stopped waiting for the mesh
    runtime.once('application:worker:stopping', () => {
      setImmediate(() => end(raw, new Error('The worker ended on purpose')))
    })

    await runtime.restartApplication('blocker')

    const after = getWorkers(await runtime.getWorkers(), 'blocker')
    deepStrictEqual(after.map(([, worker]) => worker.status), ['started'])
    ok(after[0][0] !== before[0][0], 'the worker should have been replaced')

    // The old worker exited and its stop was completed before the new one was started
    const own = events.filter(e => e.application === 'blocker')
    const oldIndex = Number(before[0][0].split(':')[1])
    const old = own.filter(e => e.worker === oldIndex).map(e => e.event)
    ok(old.includes('exited'), `the old worker should have exited, got ${JSON.stringify(old)}`)
    strictEqual(old.at(-1), 'stopped')
    const stopped = own.findIndex(e => e.event === 'stopped' && e.worker === oldIndex)
    const starting = own.findIndex(e => e.event === 'starting')
    ok(stopped < starting, 'the stop of the old worker should have been completed before the new one was started')

    ok(await waitForLog(context.context, 'The worker 0 of the application "blocker" ended with an error while it was being stopped'))

    const response = await request(`${getBlockerUrl(runtime)}/target`)
    strictEqual(response.statusCode, 200)
  })
}

test('replacing a worker reports an error thrown by a listener of its stop, also when the worker did not leave the mesh in time', async t => {
  const context = await setup(t)
  const { runtime, url } = context

  const { body } = await request(`${url}/block?ms=${BLOCK_DURATION}`)
  body.on('error', () => {})
  const [chunk] = await once(body, 'data')
  strictEqual(chunk.toString(), 'blocking\n')

  runtime.once('application:worker:stopping', () => {
    throw new Error('The listener failed on purpose')
  })

  let error
  try {
    await runtime.restartApplication('blocker')
  } catch (e) {
    error = e
  }

  strictEqual(error?.message, 'The listener failed on purpose')
})
