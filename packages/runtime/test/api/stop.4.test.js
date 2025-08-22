import { ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should kill the thread even if stop fails', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  const { statusCode } = await app.inject('with-logger', {
    method: 'GET',
    url: '/crash-on-close'
  })
  strictEqual(statusCode, 200)

  // Should not fail and hang
  const start = process.hrtime.bigint()
  await app.close()
  const elapsed = Number(process.hrtime.bigint() - start) / 1e6

  // We are satisfied if killing took less that twice of the allowed timeout
  const config = await app.getRuntimeConfig()
  ok(elapsed < config.gracefulShutdown.runtime * 2)
})
