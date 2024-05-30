'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get services topology', async (t) => {
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
    path: '/api/v1/services'
  })

  assert.strictEqual(statusCode, 200)

  const entrypointDetails = await app.getEntrypointDetails()
  const topology = await body.json()

  assert.deepStrictEqual(topology, {
    entrypoint: 'service-1',
    services: [
      {
        id: 'service-1',
        type: 'service',
        status: 'started',
        entrypoint: true,
        url: entrypointDetails.url,
        localUrl: 'http://service-1.plt.local',
        dependencies: []
      },
      {
        id: 'service-2',
        type: 'service',
        status: 'started',
        entrypoint: false,
        localUrl: 'http://service-2.plt.local',
        dependencies: []
      },
      {
        id: 'service-db',
        type: 'db',
        status: 'started',
        entrypoint: false,
        localUrl: 'http://service-db.plt.local',
        dependencies: []
      }
    ]
  })
})
