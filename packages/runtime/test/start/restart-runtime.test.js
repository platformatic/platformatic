import { deepStrictEqual, fail, ok, strictEqual } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { transform } from '../../lib/config.js'
import { createRuntime, getTempDir } from '../helpers.js'
import { prepareRuntime } from '../multiple-workers/helper.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('can restart the runtime apps', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
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
  const configPath = join(fixturesDir, 'crash-on-bootstrap', 'platformatic.runtime.json')

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
  const configFile = join(fixturesDir, 'parallel-restart', 'platformatic.json')
  const app = await createRuntime(configFile)
  let { 'composer:0': url } = await app.start()

  t.after(async () => {
    await app.close()
  })

  const events = []

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
})

test('restartApplication restarts each original worker exactly once', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = join(root, './platformatic.json')
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
