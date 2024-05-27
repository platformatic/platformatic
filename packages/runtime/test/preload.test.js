'use strict'
const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')

test('preload', async (t) => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'preload', 'platformatic.runtime.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)
  const entryUrl = await app.start()

  t.after(() => {
    return app.close()
  })

  {
    const res = await request(entryUrl + '/hello')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { value: 42 })
  }
})
