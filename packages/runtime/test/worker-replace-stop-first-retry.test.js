import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { rmSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { transform } from '../index.js'
import { createRuntime, readLogs } from './helpers.js'
import { findAvailablePortRange } from './multiple-workers/helper.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')
const fixture = join(fixturesDir, 'replace-stop-first-retry')
const failureMessage = 'The application failed to start on purpose'

function getMainWorkers (workers) {
  return Object.entries(workers).filter(([id]) => id.startsWith('main:'))
}

function count (events, name) {
  return events.filter(({ event }) => event === name).length
}

// The entrypoint of the fixture does not reuse its TCP port, so its worker is stopped before its
// replacement is started. The replacement fails to start for as long as the marker file exists.
async function setup (t, restartOnError, configure) {
  const marker = join(tmpdir(), `plt-fail-start-${process.pid}-${Date.now()}`)
  process.env.PLT_TESTS_FAIL_START_MARKER = marker

  const context = {
    async transform (config, ...args) {
      configure?.(config)
      config = await transform(config, ...args)

      if (typeof restartOnError !== 'undefined') {
        config.restartOnError = restartOnError
      }

      return config
    }
  }

  const runtime = await createRuntime(fixture, null, context)
  const url = await runtime.start()

  t.after(async () => {
    rmSync(marker, { force: true })
    delete process.env.PLT_TESTS_FAIL_START_MARKER
    await runtime.close()
  })

  const response = await request(url)
  strictEqual(response.statusCode, 200)
  await response.body.dump()

  const before = getMainWorkers(await runtime.getWorkers())

  // Every worker that is created from now on (init) and every start of one, in order
  const events = []
  for (const event of ['init', 'starting', 'started', 'start:error', 'start:failed']) {
    runtime.on(`application:worker:${event}`, payload => {
      events.push({ event, worker: payload.worker })
    })
  }

  for (const event of ['restarted', 'stopped']) {
    runtime.on(`application:${event}`, () => {
      events.push({ event: `application:${event}` })
    })
  }

  return { runtime, url, marker, context, before, events }
}

// Resolves once the replacement has announced its next attempt, which it does right before it waits
async function waitForNextAttempt (context) {
  for (let i = 0; i < 200; i++) {
    const logs = await readLogs(context.logsPath, 0)
    if (logs.some(log => log.msg?.startsWith('Attempt 1 of 5 to start a replacement'))) {
      return
    }

    await sleep(25)
  }

  throw new Error('The replacement did not announce its next attempt')
}

function settled (promise) {
  return promise.then(
    () => 'resolved',
    error => `rejected: ${error.message}`
  )
}

test('a replacement that stops the old worker first starts another worker when the new one fails to start', async t => {
  const { runtime, url, marker, context, before, events } = await setup(t)
  strictEqual(before.length, 1)

  // The first two starts of the replacement fail, the third one succeeds
  await writeFile(marker, '')
  runtime.on('application:worker:start:error', () => {
    if (count(events, 'start:error') === 2) {
      rmSync(marker, { force: true })
    }
  })

  await runtime.restartApplication('main')

  const after = getMainWorkers(await runtime.getWorkers())
  deepStrictEqual(
    after.map(([, worker]) => worker.status),
    ['started'],
    `expected a single started worker, got ${JSON.stringify(after)}`
  )
  ok(after[0][0] !== before[0][0], 'the worker should have been replaced')

  strictEqual(count(events, 'init'), 3)
  strictEqual(count(events, 'starting'), 3)
  strictEqual(count(events, 'start:error'), 2)
  strictEqual(count(events, 'started'), 1)
  strictEqual(count(events, 'start:failed'), 0)
  strictEqual(count(events, 'application:restarted'), 1)
  // Each attempt uses a new worker
  strictEqual(new Set(events.filter(({ event }) => event === 'starting').map(({ worker }) => worker)).size, 3)

  // The entrypoint is back on the port it had before the replacement
  strictEqual(runtime.getUrl(), url)
  const response = await request(url)
  strictEqual(response.statusCode, 200)
  deepStrictEqual(await response.body.json(), { from: 'main' })

  // And it is reachable through the runtime as well
  const injected = await runtime.inject('main', { method: 'GET', url: '/' })
  strictEqual(injected.statusCode, 200)

  const logs = await readLogs(context.logsPath, 0)
  const messages = logs.map(log => log.msg).filter(Boolean)
  ok(messages.some(m => m.startsWith('Attempt 1 of 5 to start a replacement for worker 0 of the application "main" again')))
  ok(messages.some(m => m.startsWith('Attempt 2 of 5 to start a replacement for worker 0 of the application "main" again')))
  ok(!messages.some(m => m.includes('unexpectedly exited')), 'no worker should be reported as crashed')
})

test('a replacement that stops the old worker first keeps the port of the worker it replaces', async t => {
  const host = '127.0.0.1'
  const basePort = await findAvailablePortRange({ host, size: 2 })
  const { runtime, marker, before, events } = await setup(t, 50, config => {
    config.workers = 2
    config.server = { hostname: host, port: basePort, portAssignment: 'perWorkerIncrement' }
  })
  strictEqual(before.length, 2)

  // The first start of the replacement of each worker fails
  let failures = 0
  runtime.on('application:worker:starting', () => {
    rmSync(marker, { force: true })

    if (count(events, 'started') === failures && failures < 2) {
      failures++
      writeFileSync(marker, '')
    }
  })

  await runtime.restartApplication('main')

  strictEqual(count(events, 'start:error'), 2)
  strictEqual(count(events, 'started'), 2)
  const after = getMainWorkers(await runtime.getWorkers())
  deepStrictEqual(after.map(([, worker]) => worker.status), ['started', 'started'])

  // Each worker listens on the port of the worker it replaced
  for (const port of [basePort, basePort + 1]) {
    const response = await request(`http://${host}:${port}`)
    strictEqual(response.statusCode, 200)
    deepStrictEqual(await response.body.json(), { from: 'main' })
  }
})

test('a replacement that stops the old worker first gives up after as many attempts as a boot', async t => {
  const { runtime, marker, events } = await setup(t, 50)
  await writeFile(marker, '')

  await rejects(runtime.restartApplication('main'), { message: failureMessage })

  // One start plus five attempts
  strictEqual(count(events, 'init'), 6)
  strictEqual(count(events, 'starting'), 6)
  strictEqual(count(events, 'start:error'), 6)
  strictEqual(count(events, 'start:failed'), 1)
  strictEqual(count(events, 'started'), 0)
  strictEqual(count(events, 'application:restarted'), 0)
  deepStrictEqual(getMainWorkers(await runtime.getWorkers()), [])

  // Nothing starts later on its own
  await sleep(1000)
  strictEqual(count(events, 'init'), 6)
})

for (const restartOnError of [false, 0]) {
  test(`a replacement that stops the old worker first does not retry when restartOnError is ${restartOnError}`, async t => {
    const { runtime, marker, events } = await setup(t, restartOnError)
    await writeFile(marker, '')

    await rejects(runtime.restartApplication('main'), { message: failureMessage })

    strictEqual(count(events, 'init'), 1)
    strictEqual(count(events, 'start:error'), 1)
    strictEqual(count(events, 'start:failed'), 0)
    strictEqual(count(events, 'application:restarted'), 0)
    deepStrictEqual(getMainWorkers(await runtime.getWorkers()), [])
  })
}

test('a replacement that stops the old worker first does not retry a worker that could not bind its port', async t => {
  const { runtime, url, events } = await setup(t, 50)

  // Take the port of the entrypoint as soon as its old worker has released it
  const server = createServer()
  t.after(() => new Promise(resolve => server.close(resolve)))
  const listening = new Promise((resolve, reject) => {
    server.once('error', reject)
    runtime.once('application:worker:stopped', () => {
      server.listen(new URL(url).port, '127.0.0.1', resolve)
    })
  })

  const restart = settled(runtime.restartApplication('main'))
  await listening
  const outcome = await restart

  ok(outcome.startsWith('rejected: '), outcome)
  ok(outcome.includes('EADDRINUSE') || outcome.includes('address already in use'), outcome)
  strictEqual(count(events, 'init'), 1)
  strictEqual(count(events, 'started'), 0)
  strictEqual(count(events, 'start:error'), 0)
  strictEqual(count(events, 'start:failed'), 0)

  await sleep(500)
  strictEqual(count(events, 'init'), 1)
})

test('a replacement that stops the old worker first does not retry a start that was interrupted before the worker was started', async t => {
  const { runtime, marker, events } = await setup(t, 50)
  await writeFile(marker, '')

  // The listener throws before the worker is asked to start, so the worker is still alive
  // when the start fails: it is terminated and no other worker is started.
  runtime.once('application:worker:starting', () => {
    throw new Error('The listener failed on purpose')
  })

  await rejects(runtime.restartApplication('main'), { message: 'The listener failed on purpose' })

  await sleep(500)
  strictEqual(count(events, 'init'), 1)
  strictEqual(count(events, 'start:error'), 0)
  strictEqual(count(events, 'started'), 0)
  deepStrictEqual(getMainWorkers(await runtime.getWorkers()), [])
})

test('a replacement that stops the old worker first ends when the runtime is closed right after a failed start', async t => {
  const { runtime, marker, events } = await setup(t, 2000)
  await writeFile(marker, '')

  // Close the runtime from the listener, before the replacement handles the failure
  let closed
  runtime.once('application:worker:start:error', () => {
    closed = runtime.close()
  })

  strictEqual(await settled(runtime.restartApplication('main')), `rejected: ${failureMessage}`)
  await closed

  await sleep(2500)
  strictEqual(count(events, 'init'), 1)
  strictEqual(count(events, 'started'), 0)
  strictEqual(count(events, 'application:restarted'), 0)
})

test('a replacement that stops the old worker first ends when the runtime is closed while it waits', async t => {
  const { runtime, marker, context, events } = await setup(t, 5000)
  await writeFile(marker, '')

  const restart = settled(runtime.restartApplication('main'))

  await waitForNextAttempt(context)

  // The wait is interrupted: the replacement does not hold on for the rest of its delay
  const startedAt = Date.now()
  const closed = runtime.close()
  strictEqual(await restart, `rejected: ${failureMessage}`)
  ok(Date.now() - startedAt < 3000, 'the replacement should end as soon as the runtime is closed')
  await closed

  await sleep(5500)
  strictEqual(count(events, 'init'), 1)
  strictEqual(count(events, 'started'), 0)
  strictEqual(count(events, 'application:restarted'), 0)
})

test('a replacement that stops the old worker first does not start the application again after it was stopped', async t => {
  const { runtime, marker, context, events } = await setup(t, 3000)
  await writeFile(marker, '')

  const restart = settled(runtime.restartApplication('main'))

  await waitForNextAttempt(context)

  // Stop the application while the replacement waits, then let a start succeed
  await runtime.stopApplication('main')
  rmSync(marker, { force: true })

  strictEqual(await restart, `rejected: ${failureMessage}`)

  await sleep(3500)
  strictEqual(count(events, 'init'), 1)
  strictEqual(count(events, 'started'), 0)
  strictEqual(count(events, 'application:stopped'), 1)
  strictEqual(count(events, 'application:restarted'), 0)
  deepStrictEqual(getMainWorkers(await runtime.getWorkers()), [])
})

test('a replacement that stops the old worker first does not start the application again when it is stopped while another worker is created', async t => {
  const { runtime, marker, events } = await setup(t, 50)
  await writeFile(marker, '')

  // The first start fails. The application is stopped as soon as the next worker has been created,
  // when that worker is not registered yet, and the cause of the failure is gone by then.
  let stopped
  runtime.on('application:worker:init', () => {
    if (count(events, 'start:error') === 1 && !stopped) {
      rmSync(marker, { force: true })
      stopped = runtime.stopApplication('main')
    }
  })

  strictEqual(await settled(runtime.restartApplication('main')), `rejected: ${failureMessage}`)
  await stopped

  await sleep(500)
  strictEqual(count(events, 'init'), 2)
  strictEqual(count(events, 'started'), 0)
  strictEqual(count(events, 'application:restarted'), 0)
  deepStrictEqual(getMainWorkers(await runtime.getWorkers()), [])
})

test('a replacement that stops the old worker first does not retry when a listener of the failure throws', async t => {
  const { runtime, marker, events } = await setup(t, 50)
  await writeFile(marker, '')

  // The worker has been disposed of when the listener runs, but the error that ends the
  // start is the one of the listener: it is reported as it is, without another worker.
  runtime.once('application:worker:start:error', () => {
    rmSync(marker, { force: true })
    throw new Error('The listener failed on purpose')
  })

  await rejects(runtime.restartApplication('main'), { message: 'The listener failed on purpose' })

  await sleep(500)
  strictEqual(count(events, 'init'), 1)
  strictEqual(count(events, 'started'), 0)
  deepStrictEqual(getMainWorkers(await runtime.getWorkers()), [])
})

test('a replacement that stops the old worker first does not retry when a listener throws once the worker has started', async t => {
  const { runtime, events } = await setup(t, 50)

  // The worker did start: the error of the listener ends the replacement as it does today
  runtime.once('application:worker:started', () => {
    throw new Error('The listener failed on purpose')
  })

  await rejects(runtime.restartApplication('main'), { message: 'The listener failed on purpose' })

  await sleep(500)
  strictEqual(count(events, 'init'), 1)
  strictEqual(count(events, 'started'), 1)
})

test('a replacement that stops the old worker first does not retry when a listener throws no error', async t => {
  const { runtime, events } = await setup(t, 50)

  runtime.once('application:worker:starting', () => {
    // eslint-disable-next-line no-throw-literal
    throw undefined
  })

  strictEqual(await settled(runtime.restartApplication('main').then(() => {}, error => Promise.reject(new Error(String(error))))), 'rejected: undefined')

  await sleep(500)
  strictEqual(count(events, 'init'), 1)
  strictEqual(count(events, 'started'), 0)
  deepStrictEqual(getMainWorkers(await runtime.getWorkers()), [])
})

test('a replacement that stops the old worker first starts another worker at once when restartOnError is a few milliseconds', async t => {
  const { runtime, url, marker, context, events } = await setup(t, 2)
  await writeFile(marker, '')

  runtime.once('application:worker:start:error', () => {
    rmSync(marker, { force: true })
  })

  await runtime.restartApplication('main')

  strictEqual(count(events, 'start:error'), 1)
  strictEqual(count(events, 'started'), 1)
  strictEqual(runtime.getUrl(), url)

  const logs = await readLogs(context.logsPath, 0)
  const messages = logs.map(log => log.msg).filter(Boolean)
  ok(messages.some(m => m.startsWith('Performing attempt 1 of 5 to start a replacement for worker 0 of the application "main" again')))
})

test('a replacement that stops the old worker first ends the restart when the application is stopped once another worker has started', async t => {
  const host = '127.0.0.1'
  const basePort = await findAvailablePortRange({ host, size: 2 })
  const { runtime, marker, before, events } = await setup(t, 50, config => {
    config.workers = 2
    config.server = { hostname: host, port: basePort, portAssignment: 'perWorkerIncrement' }
  })
  strictEqual(before.length, 2)

  // The first start of the first replacement fails. When its second start has succeeded the
  // application is stopped: the restart does not go on to replace the other worker.
  await writeFile(marker, '')
  runtime.once('application:worker:start:error', () => {
    rmSync(marker, { force: true })
  })

  let stopped
  runtime.once('application:worker:started', () => {
    stopped = runtime.stopApplication('main')
  })

  strictEqual(await settled(runtime.restartApplication('main')), `rejected: ${failureMessage}`)
  await stopped

  await sleep(500)
  strictEqual(count(events, 'init'), 2)
  strictEqual(count(events, 'application:restarted'), 0)
  deepStrictEqual(getMainWorkers(await runtime.getWorkers()), [])
})
