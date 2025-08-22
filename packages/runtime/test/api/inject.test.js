import { strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should inject request to application', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const res = await app.inject('with-logger', {
    method: 'GET',
    url: '/'
  })

  strictEqual(res.statusCode, 200)
  strictEqual(res.statusMessage, 'OK')

  strictEqual(res.headers['content-type'], 'application/json; charset=utf-8')
  strictEqual(res.headers['content-length'], '17')
  strictEqual(res.headers.connection, 'keep-alive')

  strictEqual(res.body, '{"hello":"world"}')
})

test('should fail inject request is application is not started', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)
  await app.init()

  t.after(async () => {
    await app.close()
  })

  try {
    await app.inject('with-logger', { method: 'GET', url: '/' })
  } catch (err) {
    strictEqual(err.message, "Application with id 'with-logger' is not started")
  }
})
