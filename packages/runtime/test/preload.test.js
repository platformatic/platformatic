'use strict'
const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { createRuntime } = require('./helpers.js')
const fixturesDir = join(__dirname, '..', 'fixtures')

test('preload', async t => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'preload', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
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

test('preload multiple', async t => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'preload-multiple', 'platformatic-single-service.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => {
    return app.close()
  })

  {
    const res = await request(entryUrl + '/preload')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { value: '12' })
  }
})

test('preload multiple on runtime and preload multiple on services', async t => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'preload-multiple', 'platformatic-multiple-service.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => {
    return app.close()
  })

  {
    const res = await request(entryUrl + '/a/preload')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { value: '1234' })
  }

  {
    const res = await request(entryUrl + '/b/preload')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { value: '125' })
  }
})
