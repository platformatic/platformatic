'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { platformaticRuntime } = require('../..')
const { buildRuntime } = require('../../lib/start')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('can start with a custom environment', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildRuntime(config.configManager, { A_CUSTOM_ENV_VAR: 'foobar' })

  t.after(async () => {
    await app.close()
  })

  const entryUrl = await app.start()
  const res = await request(entryUrl + '/env')

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), {
    A_CUSTOM_ENV_VAR: 'foobar',
    PLT_ENVIRONMENT: 'development',
    PLT_DEV: 'true'
  })
  process.exitCode = 0
})

test('should pass global .env data to workers', async t => {
  const configFile = join(fixturesDir, 'env', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildRuntime(config.configManager)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const { payload } = await app.inject('hello', {
    method: 'GET',
    url: '/'
  })
  const data = JSON.parse(payload)

  assert.deepStrictEqual(data, {
    FROM_ENV_FILE: 'true',
    FROM_MAIN_CONFIG_FILE: 'true',
    FROM_SERVICE_CONFIG_FILE: 'true',
    OVERRIDE_TEST: 'service-override'
  })
})
