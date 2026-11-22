import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { rmSync } from 'node:fs'
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

// The URL of the (only) worker of the application, which keeps its port across replacements
function getMainUrl (runtime) {
  return Object.values(runtime.getUrls('main'))[0]
}

function count (events, name) {
  return events.filter(({ event }) => event === name).length
}

// The application of the fixture does not reuse its TCP port, so its worker is stopped before its
// replacement is started. The replacement fails to start for as long as the marker file exists.
// The port (and the number of workers) of the application are given to the fixture via the environment.
async function setup (t, restartOnError, { workers = 1, portAssignment = 'shared' } = {}) {
  const marker = join(tmpdir(), `plt-fail-start-${process.pid}-${Date.now()}`)
  const host = '127.0.0.1'
  const basePort = await findAvailablePortRange({ host, size: workers })
  const environment = {
    PLT_TESTS_FAIL_START_MARKER: marker,
    PLT_TESTS_REPLACE_PORT: String(basePort),
    PLT_TESTS_REPLACE_PORT_ASSIGNMENT: portAssignment,
    PLT_TESTS_REPLACE_WORKERS: String(workers)
  }
  Object.assign(process.env, environment)

  const context = {
    async transform (config, ...args) {
      config = await transform(config, ...args)

      if (typeof restartOnError !== 'undefined') {
        config.restartOnError = restartOnError
      }

      return config
    }
  }

  const runtime = await createRuntime(fixture, null, context)
  await runtime.start()
  const url = getMainUrl(runtime)

  t.after(async () => {
    rmSync(marker, { force: true })

    for (const key of Object.keys(environment)) {
      delete process.env[key]
    }

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

  // The warnings of the runtime, as they are logged: a start that fails announces the next attempt
  // with one, right before it waits.
  const warnings = []
  const warn = runtime.logger.warn.bind(runtime.logger)
  runtime.logger.warn = (...args) => {
    warnings.push(args.find(arg => typeof arg === 'string'))
    runtime.emit('test:warning', warnings.at(-1))
    return warn(...args)
  }

  return { runtime, url, host, basePort, marker, before, events, warnings }
}

/*
  When the old worker was already stopped, the replacement that fails to start leaves its replica
  without a worker. The restart reports that failure to its caller and the runtime refills the
  replica in the background, like it does for a worker that crashed: each failed start is followed by
  another attempt, up to the same number of attempts as a boot.
*/
test('a replacement that stops the old worker first refills the replica when the new one fails to start', async t => {
  const { runtime, url, marker, before, events, warnings } = await setup(t, 20)
  strictEqual(before.length, 1)

  // The first two starts fail, the third one succeeds
  await writeFile(marker, '')
  runtime.on('application:worker:starting', () => {
    if (count(events, 'starting') === 3) {
      rmSync(marker, { force: true })
    }
  })

  const started = once(runtime, 'application:worker:started')
  await rejects(runtime.restartApplication('main'), { message: failureMessage })
  await started

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
  // Every start that fails is reported, the last one is not a failure of the whole operation
  strictEqual(count(events, 'start:error'), 2)
  strictEqual(count(events, 'start:failed'), 0)
  // Each attempt uses a new worker
  strictEqual(new Set(events.filter(({ event }) => event === 'starting').map(({ worker }) => worker)).size, 3)

  // The application is back on the port it had before the replacement
  strictEqual(getMainUrl(runtime), url)
  const response = await request(url)
  strictEqual(response.statusCode, 200)
  deepStrictEqual(await response.body.json(), { from: 'main' })

  // And it is reachable through the runtime as well
  const injected = await runtime.inject('main', { method: 'GET', url: '/' })
  strictEqual(injected.statusCode, 200)

  deepStrictEqual(
    warnings.filter(m => m?.includes('to start the worker')).map(m => m.slice(0, 68)),
    ['Attempt 1 of 5 to start the worker 2 of the application "main" again']
  )
  ok(!warnings.some(m => m?.includes('unexpectedly exited')), 'no worker should be reported as crashed')
})

test('a replacement that stops the old worker first keeps the port of the worker it replaces', async t => {
  const { runtime, host, basePort, marker, before, events } = await setup(t, 20, {
    workers: 2,
    portAssignment: 'perWorkerIncrement'
  })
  strictEqual(before.length, 2)

  // The first start of the replacement fails
  await writeFile(marker, '')
  runtime.on('application:worker:starting', () => {
    if (count(events, 'starting') === 2) {
      rmSync(marker, { force: true })
    }
  })

  const started = once(runtime, 'application:worker:started')
  await rejects(runtime.restartApplication('main'), { message: failureMessage })
  await started

  const after = getMainWorkers(await runtime.getWorkers())
  deepStrictEqual(after.map(([, worker]) => worker.status), ['started', 'started'])
  strictEqual(count(events, 'start:error'), 1)

  // The worker that was replaced has the port it had, and the other one is untouched
  for (const port of [basePort, basePort + 1]) {
    const response = await request(`http://${host}:${port}`)
    strictEqual(response.statusCode, 200)
    deepStrictEqual(await response.body.json(), { from: 'main' })
  }
})

test('a replacement that stops the old worker first gives up after as many attempts as a boot', async t => {
  const { runtime, marker, events } = await setup(t, 20)
  await writeFile(marker, '')

  const failed = once(runtime, 'application:worker:start:failed')
  await rejects(runtime.restartApplication('main'), { message: failureMessage })
  await failed

  // The start of the replacement plus one start and five attempts of the refill, reported as one failure
  strictEqual(count(events, 'init'), 7)
  strictEqual(count(events, 'starting'), 7)
  strictEqual(count(events, 'start:error'), 7)
  strictEqual(count(events, 'start:failed'), 1)
  strictEqual(events.at(-1).event, 'start:failed')
  strictEqual(events.at(-1).worker, events.findLast(({ event }) => event === 'starting').worker)
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

  // Take the port of the application as soon as its old worker has released it
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
  strictEqual(count(events, 'started'), 0)
  // Neither the replacement nor the refill that follows it retries after that error
  strictEqual(count(events, 'start:failed'), 0)
  ok(count(events, 'starting') <= 2, `unexpected number of starts: ${count(events, 'starting')}`)
})

test('a replacement that stops the old worker first does not retry when a listener throws before the worker is asked to start', async t => {
  const { runtime, marker, events } = await setup(t, 20)
  await writeFile(marker, '')

  // The worker is still alive when the start ends: it is terminated and no other worker is started
  runtime.once('application:worker:starting', () => {
    throw new Error('The listener failed on purpose')
  })

  await rejects(runtime.restartApplication('main'), { message: 'The listener failed on purpose' })

  strictEqual(count(events, 'start:failed'), 0)
  strictEqual(count(events, 'started'), 0)
})

test('a replacement that stops the old worker first starts no other worker once the runtime is closed', async t => {
  const { runtime, marker, events } = await setup(t, 1000)
  await writeFile(marker, '')

  // Close the runtime as soon as the refill has announced its next attempt, which is when its wait
  // begins, then let a start succeed
  const announced = new Promise(resolve => {
    runtime.on('test:warning', message => {
      if (message?.startsWith('Attempt 1 of 5 to start the worker')) {
        resolve()
      }
    })
  })

  await rejects(runtime.restartApplication('main'), { message: failureMessage })
  await announced
  const closed = runtime.close()
  rmSync(marker, { force: true })
  await closed

  strictEqual(count(events, 'started'), 0)
  strictEqual(count(events, 'application:restarted'), 0)
  deepStrictEqual(getMainWorkers(await runtime.getWorkers()), [])
})
