'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get runtime config', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

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
    await Promise.all([client.close(), app.close()])
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/config',
  })

  assert.strictEqual(statusCode, 200)

  const runtimeConfig = await body.json()
  assert.strictEqual(runtimeConfig.entrypoint, 'service-1')
  assert.strictEqual(runtimeConfig.watch, false)
  assert.deepStrictEqual(runtimeConfig.autoload, {
    path: join(projectDir, 'services'),
    exclude: [],
  })
  assert.deepStrictEqual(runtimeConfig.managementApi, {
    logs: { maxSize: 6 },
  })
})
