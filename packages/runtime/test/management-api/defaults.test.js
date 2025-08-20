'use strict'

const { strictEqual, rejects } = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

// Make sure this test is run first otherwise it might fail on the CI
test('should disable the management API if requested to', async t => {
  const projectDir = join(fixturesDir, 'management-api-defaults')
  const configFile = join(projectDir, 'platformatic-no-api.json')
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

  await rejects(() => client.request({ method: 'GET', path: '/api/v1/config' }), { code: /ECONNREFUSED/ })
})

test('should enable the management API by default', async t => {
  const projectDir = join(fixturesDir, 'management-api-defaults')
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

  const { statusCode, body } = await client.request({ method: 'GET', path: '/api/v1/config' })
  strictEqual(statusCode, 200)

  const runtimeConfig = await body.json()
  strictEqual(runtimeConfig.entrypoint, 'main')
})
