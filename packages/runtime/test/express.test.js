'use strict'
const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { create } = require('../index.js')
const fixturesDir = join(__dirname, '..', 'fixtures')

test('composer', async t => {
  const configFile = join(fixturesDir, 'express', 'platformatic.runtime.json')
  const app = await create(configFile)
  await app.init()
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
