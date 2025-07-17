'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { create } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should stop the runtimes with a management api', async t => {
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
  })

  const { statusCode, body } = await client.request({
    method: 'POST',
    path: '/api/v1/stop',
  })
  await body.text()

  assert.strictEqual(statusCode, 200)
})
