'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get service details', async (t) => {
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
    path: '/api/services/service-1'
  })

  assert.strictEqual(statusCode, 200)

  const entrypointDetails = await app.getEntrypointDetails()
  const serviceDetails = await body.json()
  assert.deepStrictEqual(serviceDetails, {
    id: 'service-1',
    type: 'service',
    status: 'started',
    entrypoint: true,
    url: entrypointDetails.url,
    localUrl: 'http://service-1.plt.local',
    dependencies: []
  })
})
