'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { platformaticRuntime } = require('../..')
const { startWithConfig } = require('../../lib/start')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('can start with a custom environment', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await startWithConfig(config.configManager, { A_CUSTOM_ENV_VAR: 'foobar' })

  t.after(async () => {
    await app.close()
  })

  const entryUrl = await app.start()
  const res = await request(entryUrl + '/env')

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), { A_CUSTOM_ENV_VAR: 'foobar' })
  process.exitCode = 0
})
