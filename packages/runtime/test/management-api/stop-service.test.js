'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should stop service by service id', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(async () => {
    await Promise.all([
      app.close(),
      app.managementApi.close()
    ])
  })
  {
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'started')
  }

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })

  t.after(async () => {
    await client.close()
  })

  const { statusCode, body } = await client.request({
    method: 'POST',
    path: '/api/services/service-1/stop'
  })
  await body.text()

  assert.strictEqual(statusCode, 200)

  {
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }
})

test('should start stopped service by service id', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(async () => {
    await Promise.all([
      app.close(),
      app.managementApi.close()
    ])
  })

  await app.stopService('service-1')

  {
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })

  t.after(async () => {
    await client.close()
  })

  const { statusCode, body } = await client.request({
    method: 'POST',
    path: '/api/services/service-1/start'
  })
  await body.text()

  assert.strictEqual(statusCode, 200)

  {
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'started')
  }
})

test('should proxy request to the service', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })

  t.after(async () => {
    await Promise.all([
      client.close(),
      app.close(),
      app.managementApi.close()
    ])
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/services/service-2/proxy/hello'
  })

  assert.strictEqual(statusCode, 200)

  const data = await body.json()
  assert.deepStrictEqual(data, { service: 'service-2' })
})

test('should get service metrics via runtime management api proxy', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/services/service-1/proxy/metrics'
  })

  assert.strictEqual(statusCode, 200)

  const data = await body.text()
  assert.ok(data)
})
