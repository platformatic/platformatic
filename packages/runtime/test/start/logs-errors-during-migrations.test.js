'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { loadConfiguration } = require('@platformatic/db')
const { Client } = require('undici')
const { wrapInRuntimeConfig, transform } = require('../../lib/config')
const { Runtime } = require('../../index')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('logs errors during db migrations', async t => {
  const configFile = join(fixturesDir, 'dbAppWithMigrationError', 'platformatic.db.json')
  const config = await loadConfiguration(configFile)
  const runtimeConfig = await wrapInRuntimeConfig(config, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.restartOnError = 1000
      return config
    }
  })

  const runtime = new Runtime(runtimeConfig)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()

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
