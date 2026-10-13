import { ITC } from '@platformatic/itc'
import { deepStrictEqual, fail, ok, strictEqual } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { features } from '@platformatic/foundation'
import { transform } from '../../index.js'
import { configurationFileIn, createRuntime, getTempDir, updateFile } from '../helpers.js'
import { prepareRuntime } from '../multiple-workers/helper.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('can restart the runtime apps', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo', 'watt.config.mjs')
  const app = await createRuntime(configFile)
  let { 'serviceApp:0': url } = await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const res = await request(url + '/upstream')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { hello: 'world' })
  }

  await app.restart()
  url = (await app.getApplicationDetails('serviceApp')).url

  {
    const res = await request(url + '/upstream')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { hello: 'world' })
  }
  process.exitCode = 0
})

test('do not restart if application is not started', async t => {
  const logsPath = join(await getTempDir(), `log-${Date.now()}.txt`)
  const configPath = join(fixturesDir, 'crash-on-bootstrap', 'watt.config.mjs')

  const app = await createRuntime(configPath, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)

      config.logger = {
        ...config.logger,
        level: 'trace',
        transport: {
          target: 'pino/file',
          options: { destination: logsPath }
        }
      }

      return config
    }
  })

  try {
    await app.start()
    fail('expected an error')
  } catch (err) {
    strictEqual(err.message, 'Crash!')
  }

  const logs = await readFile(logsPath, 'utf8')

  for (let attempt = 1; attempt <= 5; attempt++) {
    const worker = attempt - 1
    ok(
      logs.includes(
        `Attempt ${attempt} of 5 to start the worker ${worker} of the application \\"service-2\\" again will be performed in 100ms ...`
      )
    )
  }

  ok(logs.includes('Failed to start worker 5 of the application \\"service-2\\" after 5 attempts.'))
  ok(logs.includes('Stopping the worker 0 of the application \\"service-1\\"...'))
})

test('will restart applications in parallel', async t => {
  const configFile = join(fixturesDir, 'parallel-restart', 'watt.config.mjs')
  const app = await createRuntime(configFile)
  let { 'composer:0': url } = await app.start()

  t.after(async () => {
    await app.close()
  })

  const events = []
  const workerEvents = []

  {
    const res = await request(url + '/application-1')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { ok: true })
  }

  {
    const res = await request(url + '/application-2')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { ok: true })
  }

  for (const event of ['restarting', 'restarted', 'application:restarting', 'application:restarted']) {
    app.on(event, id => {
      events.push([event, id])
    })
  }

  app.on('application:worker:started', ({ worker }) => {
    if (worker >= 3) {
      workerEvents.push('started')
    }
  })
  app.on('application:worker:stopped', ({ worker }) => {
    if (worker < 3) {
      workerEvents.push('stopped')
    }
  })

  await app.restart()
  url = (await app.getApplicationDetails('composer')).url

  {
    const res = await request(url + '/application-1')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { ok: true })
  }

  {
    const res = await request(url + '/application-2')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { ok: true })
  }

  strictEqual(events[0][0], 'restarting')
  strictEqual(events.at(-1)[0], 'restarted')
  ok(events.findIndex(e => e[0] === 'application:restarting') !== -1)
  ok(events.findIndex(e => e[0] === 'application:restarted') !== -1)

  // All applications should trigger a restart before the previous one is finished
  ok(
    events.findLastIndex(e => e[0] === 'application:restarting') <
      events.findIndex(e => e[0] === 'application:restarted')
  )

  if (features.node.reusePort) {
    strictEqual(workerEvents.filter(event => event === 'started').length, 9)
    strictEqual(workerEvents.filter(event => event === 'stopped').length, 9)
    strictEqual(workerEvents.lastIndexOf('started') < workerEvents.indexOf('stopped'), true)
  }
})

test('restartApplication restarts each original worker exactly once', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = configurationFileIn(root)
  const app = await createRuntime(configFile, null, { isProduction: true })

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const started = []
  const stopped = []

  app.on('application:worker:started', ({ application, worker }) => {
    if (application === 'node') {
      started.push(worker)
    }
  })

  app.on('application:worker:stopped', ({ application, worker }) => {
    if (application === 'node') {
      stopped.push(worker)
    }
  })

  await app.restartApplication('node')

  deepStrictEqual(started, [5, 6, 7, 8, 9])
  deepStrictEqual(stopped, [0, 1, 2, 3, 4])
})

test('applications can be called while a replacement worker is starting', async t => {
  const app = await createRuntime(join(fixturesDir, 'update-service-workers', 'watt.config.mjs'))

  t.after(async () => {
    await app.close()
  })

  await app.start()

  // Hold the first replacement worker before it starts
  const replacementStarting = Promise.withResolvers()
  const resumeStart = Promise.withResolvers()
  const send = ITC.prototype.send
  t.mock.method(ITC.prototype, 'send', async function (name, ...args) {
    if (name === 'start') {
      replacementStarting.resolve()
      await resumeStart.promise
    }

    return send.call(this, name, ...args)
  })

  const restart = app.restartApplication('node')

  try {
    await replacementStarting.promise
    const workers = (await app.getApplicationResourcesInfo('node')).workers

    // Go through every worker at least twice
    for (let i = 0; i < workers * 2; i++) {
      const res = await app.inject('node', { method: 'GET', url: '/' })
      strictEqual(res.statusCode, 200)
    }
  } finally {
    resumeStart.resolve()
    await restart
  }
})

test('restarting the runtime picks up changed application scheduled tasks', async t => {
  const root = await prepareRuntime(t, 'scheduled-tasks-restart', { node: ['node'] })
  const app = await createRuntime(configurationFileIn(root))

  t.after(async () => {
    await app.close()
  })

  await app.start()
  deepStrictEqual(
    app.getSchedulerJobs().map(job => job.cron),
    ['0 0 1 1 *']
  )

  // A new version of the application is deployed with a different schedule
  await updateFile(join(root, 'node', 'index.mjs'), contents => contents.replace('0 0 1 1 *', '0 0 2 2 *'))
  await app.restart()

  deepStrictEqual(
    app.getSchedulerJobs().map(job => job.cron),
    ['0 0 2 2 *']
  )
})
