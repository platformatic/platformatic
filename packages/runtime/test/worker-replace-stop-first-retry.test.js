import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { rmSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { transform } from '../index.js'
import { createRuntime } from './helpers.js'
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

  // The warnings of the runtime, as they are logged: the replacement announces each next attempt
  // with one, right before it waits.
  const warnings = []
  const warn = runtime.logger.warn.bind(runtime.logger)
  runtime.logger.warn = (...args) => {
    warnings.push(args.find(arg => typeof arg === 'string'))
    runtime.emit('test:warning', warnings.at(-1))
    return warn(...args)
  }

  return { runtime, url, marker, before, events, warnings }
}

test('a replacement that stops the old worker first starts another worker when the new one fails to start', async t => {
  const { runtime, url, marker, before, events, warnings } = await setup(t, 20)
  strictEqual(before.length, 1)

  // The first two starts of the replacement fail, the third one succeeds
  await writeFile(marker, '')
  runtime.on('application:worker:starting', () => {
    if (count(events, 'starting') === 3) {
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
  strictEqual(count(events, 'started'), 1)
  // A replacement that recovers reports no failure
  strictEqual(count(events, 'start:error'), 0)
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

  deepStrictEqual(
    warnings.filter(m => m?.includes('to start a replacement')).map(m => m.slice(0, 82)),
    [
      'Attempt 1 of 5 to start a replacement for worker 0 of the application "main" again',
      'Attempt 2 of 5 to start a replacement for worker 0 of the application "main" again'
    ]
  )
  ok(!warnings.some(m => m?.includes('unexpectedly exited')), 'no worker should be reported as crashed')
})

test('a replacement that stops the old worker first keeps the port of the worker it replaces', async t => {
  const host = '127.0.0.1'
  const basePort = await findAvailablePortRange({ host, size: 2 })
  const { runtime, marker, before, events } = await setup(t, 20, config => {
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

  strictEqual(count(events, 'init'), 4)
  strictEqual(count(events, 'started'), 2)
  strictEqual(count(events, 'start:error'), 0)
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
  const { runtime, marker, events } = await setup(t, 20)
  await writeFile(marker, '')

  await rejects(runtime.restartApplication('main'), { message: failureMessage })

  // One start plus five attempts, reported as one failure: the one of the last worker
  strictEqual(count(events, 'init'), 6)
  strictEqual(count(events, 'starting'), 6)
  strictEqual(count(events, 'start:error'), 1)
  strictEqual(events.at(-1).event, 'start:error')
  strictEqual(events.at(-1).worker, events.findLast(({ event }) => event === 'starting').worker)
  strictEqual(count(events, 'start:failed'), 0)
  strictEqual(count(events, 'started'), 0)
  strictEqual(count(events, 'application:restarted'), 0)
  deepStrictEqual(getMainWorkers(await runtime.getWorkers()), [])
})

for (const restartOnError of [false, 0]) {
  test(`a replacement that stops the old worker first does not retry when restartOnError is ${restartOnError}`, async t => {
    const { runtime, marker, events } = await setup(t, restartOnError)
    await writeFile(marker, '')

    await rejects(runtime.restartApplication('main'), { message: failureMessage })

    strictEqual(count(events, 'init'), 1)
    strictEqual(count(events, 'start:error'), 1)
    strictEqual(count(events, 'application:restarted'), 0)
    deepStrictEqual(getMainWorkers(await runtime.getWorkers()), [])
  })
}

test('a replacement that stops the old worker first does not retry a worker that could not bind its port', async t => {
  const { runtime, url, events } = await setup(t, 20)

  // Take the port of the entrypoint as soon as its old worker has released it
  const server = createServer()
  t.after(() => new Promise(resolve => server.close(resolve)))
  const listening = new Promise((resolve, reject) => {
    server.once('error', reject)
    runtime.once('application:worker:stopped', () => {
      server.listen(new URL(url).port, '127.0.0.1', resolve)
    })
  })

  const restart = runtime.restartApplication('main').then(
    () => 'resolved',
    error => `rejected: ${error.message}`
  )
  await listening
  const outcome = await restart

  ok(outcome.startsWith('rejected: '), outcome)
  ok(outcome.includes('EADDRINUSE') || outcome.includes('address already in use'), outcome)
  strictEqual(count(events, 'init'), 1)
  strictEqual(count(events, 'started'), 0)
  strictEqual(count(events, 'start:error'), 0)
})

test('a replacement that stops the old worker first does not retry when a listener throws before the worker is asked to start', async t => {
  const { runtime, marker, events } = await setup(t, 20)
  await writeFile(marker, '')

  // The worker is still alive when the start ends: it is terminated and no other worker is started
  runtime.once('application:worker:starting', () => {
    throw new Error('The listener failed on purpose')
  })

  await rejects(runtime.restartApplication('main'), { message: 'The listener failed on purpose' })

  strictEqual(count(events, 'init'), 1)
  strictEqual(count(events, 'start:error'), 0)
  strictEqual(count(events, 'started'), 0)
  deepStrictEqual(getMainWorkers(await runtime.getWorkers()), [])
})

test('a replacement that stops the old worker first reports the failed start when a later attempt ends on another error', async t => {
  const { runtime, marker, events } = await setup(t, 20)
  await writeFile(marker, '')

  // The first start fails. The second worker never starts: a listener throws before it is asked to.
  runtime.on('application:worker:starting', () => {
    if (count(events, 'starting') === 2) {
      throw new Error('The listener failed on purpose')
    }
  })

  await rejects(runtime.restartApplication('main'), { message: 'The listener failed on purpose' })

  strictEqual(count(events, 'init'), 2)
  strictEqual(count(events, 'started'), 0)
  deepStrictEqual(
    events.filter(({ event }) => event === 'start:error'),
    [{ event: 'start:error', worker: events.find(({ event }) => event === 'starting').worker }]
  )
  deepStrictEqual(getMainWorkers(await runtime.getWorkers()), [])
})

test('a replacement that stops the old worker first starts no other worker once the runtime is closed', async t => {
  const { runtime, marker, events } = await setup(t, 1000)
  await writeFile(marker, '')

  // Close the runtime as soon as the replacement has announced its next attempt, which is when
  // its wait begins, then let a start succeed
  const announced = new Promise(resolve => {
    runtime.on('test:warning', message => {
      if (message?.startsWith('Attempt 1 of 5 to start a replacement')) {
        resolve()
      }
    })
  })
  const restart = runtime.restartApplication('main')

  // A restart that ends before the announcement fails the test here
  await Promise.race([announced, restart])
  const closed = runtime.close()
  rmSync(marker, { force: true })

  await rejects(restart, { message: failureMessage })
  await closed

  strictEqual(count(events, 'init'), 1)
  strictEqual(count(events, 'started'), 0)
  strictEqual(count(events, 'start:error'), 1)
  strictEqual(count(events, 'application:restarted'), 0)
})
