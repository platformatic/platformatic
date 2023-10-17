'use strict'
const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')

test('composer', async (t) => {
  const configFile = join(fixturesDir, 'express', 'platformatic.runtime.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const res = await request(entryUrl + '/hello')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { hello: 'world' })
  }

  {
    const res = await request(entryUrl + '/hello2')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { hello: 'world2' })
  }
})
