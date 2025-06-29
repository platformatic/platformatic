'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('composer', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  t.after(async () => {
    await app.close()
  })

  const entryUrl = await app.start()

  {
    const res = await request(entryUrl)
    assert.strictEqual(res.statusCode, 200)

    const data = await res.body.json()
    assert.deepStrictEqual(data, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }

  {
    const res = await request(entryUrl + '/service-app/')
    assert.strictEqual(res.statusCode, 200)

    const data = await res.body.json()
    assert.deepStrictEqual(data, { hello: 'hello123' })
  }
})

test('composer-proxy', async t => {
  const configFile = join(fixturesDir, 'composer-proxy', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  t.after(async () => {
    await app.close()
  })

  const entryUrl = await app.start()

  assert.ok(entryUrl.startsWith('http://127.0.0.1'), 'entryUrl should start with http://127.0.0.1')
})
