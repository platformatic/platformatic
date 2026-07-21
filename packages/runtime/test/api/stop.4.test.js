import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime, readLogs } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should kill the thread when it does not exit in time', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-single-service.json')
  const context = {}
  const app = await createRuntime(configFile, null, context)

  await app.start()

  const { statusCode } = await app.inject('main', {
    method: 'GET',
    url: '/keep-alive-on-close'
  })
  strictEqual(statusCode, 200)

  const exitTimeout = once(app, 'application:worker:exit:timeout')

  // Should not fail and hang
  const start = process.hrtime.bigint()
  await app.close()
  const elapsed = Number(process.hrtime.bigint() - start) / 1e6

  // We are satisfied if killing took less that twice of the allowed timeout
  const config = await app.getRuntimeConfig()
  ok(elapsed < config.gracefulShutdown.application * 2)

  deepStrictEqual(await exitTimeout, [{ application: 'main', worker: 0, workersCount: 1 }])

  const logs = await readLogs(context.logsPath)
  ok(logs.some(log => log.msg === 'Timeout while waiting for worker 0 of the application "main" to exit. Killing a worker thread.'))
})
