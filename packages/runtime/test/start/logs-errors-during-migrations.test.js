'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { loadConfig } = require('@platformatic/config')
const { platformaticDB } = require('@platformatic/db')
const { Client } = require('undici')
const { wrapConfigInRuntimeConfig } = require('../..')
const { buildRuntime } = require('../../lib/start')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('logs errors during db migrations', async t => {
  const configFile = join(fixturesDir, 'dbAppWithMigrationError', 'platformatic.db.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticDB)
  const runtimeConfig = await wrapConfigInRuntimeConfig(config)
  runtimeConfig.current.restartOnError = 1000

  const runtime = await buildRuntime(runtimeConfig)
  t.after(async () => {
    await runtime.close()
  })

  const startPromise = assert.rejects(async () => {
    await runtime.start()
  }, /The service "mysimplename" exited prematurely with error code 1/)

  const client = new Client({ hostname: 'localhost', protocol: 'http:' }, { socketPath: runtime.getManagementApiUrl() })

  await sleep(3000)

  const { statusCode, body } = await client.request({ method: 'GET', path: '/api/v1/logs/all' })
  assert.strictEqual(statusCode, 200)
  const messages = (await body.text()).trim().split('\n').map(JSON.parse)

  assert.ok(messages.some(m => m.msg.match(/running 001.do.sql/)))
  assert.ok(messages.some(m => m.msg?.match(/near "fiddlesticks": syntax error/)))

  await startPromise
})
