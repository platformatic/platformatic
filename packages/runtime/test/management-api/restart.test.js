'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should restart all services with a management api', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await Promise.all([client.close(), app.close()])
  })

  const { statusCode, body } = await client.request({
    method: 'POST',
    path: '/api/v1/restart'
  })
  await body.text()

  assert.strictEqual(statusCode, 200)

  {
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'started')
  }

  {
    const serviceDetails = await app.getServiceDetails('service-2')
    assert.strictEqual(serviceDetails.status, 'started')
  }
})
