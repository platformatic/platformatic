'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { create } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should stop service by service id', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  await app.start()

  {
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'started')
  }

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:',
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10,
    }
  )

  t.after(async () => {
    await client.close()
    await Promise.all([app.close()])
  })

  const { statusCode, body } = await client.request({
    method: 'POST',
    path: '/api/v1/services/service-1/stop',
  })
  await body.text()

  assert.strictEqual(statusCode, 200)

  {
    const serviceDetails = await app.getServiceDetails('service-1', true)
    assert.strictEqual(serviceDetails.status, 'stopped')
  }
})

test('should start stopped service by service id', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  await app.start()

  await app.stopService('service-1')

  {
    const serviceDetails = await app.getServiceDetails('service-1', true)
    assert.strictEqual(serviceDetails.status, 'stopped')
  }

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:',
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10,
    }
  )

  t.after(async () => {
    await client.close()
    await Promise.all([app.close()])
  })

  const { statusCode, body } = await client.request({
    method: 'POST',
    path: '/api/v1/services/service-1/start',
  })
  await body.text()

  assert.strictEqual(statusCode, 200)

  {
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'started')
  }
})

test('should proxy request to the service', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:',
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10,
    }
  )

  t.after(async () => {
    await client.close()

    await Promise.all([app.close()])
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/services/service-2/proxy/hello',
  })

  assert.strictEqual(statusCode, 200)

  const data = await body.json()
  assert.deepStrictEqual(data, { service: 'service-2' })
})
