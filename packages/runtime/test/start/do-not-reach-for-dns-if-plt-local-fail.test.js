'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('do not reach for dns if plt.local fail to resolve', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    // Basic URL on the entrypoint.
    const res = await request(entryUrl + '/unknown')

    assert.strictEqual(res.statusCode, 200)
    const body = await res.body.json()
    assert.ok(body.msg.match(/No target found for unknown.plt.local in thread \d./), [body.msg])
  }
})
