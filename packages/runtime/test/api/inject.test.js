'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should inject request to application', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const res = await app.inject('with-logger', {
    method: 'GET',
    url: '/'
  })

  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.statusMessage, 'OK')

  assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8')
  assert.strictEqual(res.headers['content-length'], '17')
  assert.strictEqual(res.headers.connection, 'keep-alive')

  assert.strictEqual(res.body, '{"hello":"world"}')
})

test('should fail inject request is application is not started', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)
  await app.init()

  t.after(async () => {
    await app.close()
  })

  try {
    await app.inject('with-logger', { method: 'GET', url: '/' })
  } catch (err) {
    assert.strictEqual(err.message, "Application with id 'with-logger' is not started")
  }
})
