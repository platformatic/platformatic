'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should start stopped application by application id', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await Promise.all([
      app.close(),
    ])
  })

  await app.stopApplication('service-1')

  {
    const applicationDetails = await app.getApplicationDetails('service-1', true)
    assert.strictEqual(applicationDetails.status, 'stopped')
  }

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:',
  }, {
    socketPath: app.getManagementApiUrl(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
  })

  t.after(async () => {
    await client.close()
  })

  const { statusCode, body } = await client.request({
    method: 'POST',
    path: '/api/v1/applications/service-1/start',
  })
  await body.text()

  assert.strictEqual(statusCode, 200)

  {
    const applicationDetails = await app.getApplicationDetails('service-1')
    assert.strictEqual(applicationDetails.status, 'started')
  }
})
