'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { create } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

const platformaticVersion = require('../../package.json').version

test('should get services topology', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

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
    method: 'GET',
    path: '/api/v1/services'
  })

  assert.strictEqual(statusCode, 200)

  const entrypointDetails = await app.getEntrypointDetails()
  const topology = await body.json()

  assert.deepStrictEqual(topology, {
    entrypoint: 'service-1',
    production: false,
    services: [
      {
        id: 'service-1',
        type: 'service',
        status: 'started',
        version: platformaticVersion,
        entrypoint: true,
        url: entrypointDetails.url,
        localUrl: 'http://service-1.plt.local',
        dependencies: []
      },
      {
        id: 'service-2',
        type: 'service',
        status: 'started',
        version: platformaticVersion,
        entrypoint: false,
        localUrl: 'http://service-2.plt.local',
        dependencies: []
      },
      {
        id: 'service-db',
        type: 'db',
        status: 'started',
        version: platformaticVersion,
        entrypoint: false,
        localUrl: 'http://service-db.plt.local',
        dependencies: []
      }
    ]
  })
})
