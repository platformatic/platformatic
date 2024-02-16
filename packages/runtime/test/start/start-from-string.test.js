'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('can start applications programmatically from string', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await buildServer(configFile)
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    // Basic URL on the entrypoint.
    const res = await request(entryUrl)

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
  }

  {
    // URL on the entrypoint that uses internal message passing.
    const res = await request(entryUrl + '/upstream')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { hello: 'world' })
  }
})
