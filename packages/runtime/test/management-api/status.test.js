'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should get the runtime status', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:',
  }, {
    socketPath: app.getManagementApiUrl(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
  })

  t.after(async () => {
    await Promise.all([
      client.close(),
      app.close(),
    ])
  })

  {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/status',
    })

    assert.strictEqual(statusCode, 200)
    const { status } = await body.json()
    assert.strictEqual(status, 'init')
  }

  const startPromise = app.start()

  {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/status',
    })

    assert.strictEqual(statusCode, 200)
    const { status } = await body.json()
    assert.strictEqual(status, 'starting')
  }

  await startPromise

  {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/status',
    })

    assert.strictEqual(statusCode, 200)
    const { status } = await body.json()
    assert.strictEqual(status, 'started')
  }
})
