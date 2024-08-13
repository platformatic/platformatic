'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get service dependencies', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

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

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/services/service-1/dependencies',
  })

  assert.strictEqual(statusCode, 200)

  const serviceDependencies = await body.json()
  assert.deepStrictEqual(serviceDependencies, [
    { id: 'service-2', url: 'http://service-2.plt.local', local: true },
    { id: 'service-db', url: 'http://service-db.plt.local', local: true },
    { id: 'service-db', url: 'http://external.com/openapi', local: false },
  ])
})
