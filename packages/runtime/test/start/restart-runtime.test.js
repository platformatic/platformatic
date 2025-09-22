import { deepStrictEqual, fail, ok, strictEqual } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { transform } from '../../lib/config.js'
import { createRuntime, getTempDir } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('can restart the runtime apps', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)
  let entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const res = await request(entryUrl + '/upstream')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { hello: 'world' })
  }

  entryUrl = await app.restart()

  {
    const res = await request(entryUrl + '/upstream')

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

  ok(logs.includes('Attempt 1 of 5 to start the application \\"service-2\\" again will be performed in 100ms ...'))
  ok(logs.includes('Attempt 2 of 5 to start the application \\"service-2\\" again will be performed in 100ms ...'))
  ok(logs.includes('Attempt 3 of 5 to start the application \\"service-2\\" again will be performed in 100ms ...'))
  ok(logs.includes('Attempt 4 of 5 to start the application \\"service-2\\" again will be performed in 100ms ...'))
  ok(logs.includes('Attempt 5 of 5 to start the application \\"service-2\\" again will be performed in 100ms ...'))

  ok(logs.includes('Failed to start application \\"service-2\\" after 5 attempts.'))
  ok(logs.includes('Stopping the application \\"service-1\\"...'))
})

test('will restart applications in parallel', async t => {
  const configFile = join(fixturesDir, 'parallel-restart', 'platformatic.json')
  const app = await createRuntime(configFile)
  let entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  const events = []

  {
    const res = await request(entryUrl + '/application-1')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { ok: true })
  }

  {
    const res = await request(entryUrl + '/application-2')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { ok: true })
  }

  for (const event of ['restarting', 'restarted', 'application:restarting', 'application:restarted']) {
    app.on(event, id => {
      events.push([event, id])
    })
  }

  entryUrl = await app.restart()

  {
    const res = await request(entryUrl + '/application-1')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { ok: true })
  }

  {
    const res = await request(entryUrl + '/application-2')

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
