'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { create } = require('../index.js')
const { Client } = require('undici')
const { setLogFile } = require('./helpers')

test.beforeEach(setLogFile)

const fixturesDir = join(__dirname, '..', 'fixtures')

test('parses composer and client dependencies', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-dependencies.json')
  const runtime = await create(configFile)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  const { services } = await runtime.getServices()

  const mainService = services.find(service => service.id === 'main')

  assert.deepStrictEqual(mainService.dependencies, [
    { id: 'service-1', url: 'http://service-1.plt.local', local: true },
    {
      id: 'external-service-1',
      url: 'http://external-dependency-1',
      local: false
    }
  ])

  const service1 = services.find(service => service.id === 'service-1')
  assert.deepStrictEqual(service1.dependencies, [])

  const service2 = services.find(service => service.id === 'service-2')
  assert.deepStrictEqual(service2.dependencies, [])
})

test('correct throws on missing dependencies', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-missing-dependencies.json')
  const runtime = await create(configFile)

  t.after(async () => {
    await runtime.close()
  })

  await assert.rejects(() => runtime.init(), {
    name: 'FastifyError',
    message: "Missing dependency: \"service 'composer' has unknown dependency: 'missing'.\""
  })
})

test('correct throws on missing dependencies, showing all services', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-missing-dependencies2.json')
  const runtime = await create(configFile)

  t.after(async () => {
    await runtime.close()
  })

  await assert.rejects(() => runtime.init(), {
    name: 'FastifyError',
    message:
      "Missing dependency: \"service 'main' has unknown dependency: 'service-1'. Did you mean 'service-2'? Known services are: service-2.\""
  })
})

test('correct warns on reversed dependencies', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-reversed-dependencies.json')
  const runtime = await create(configFile)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: runtime.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  await sleep(5000)

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/all'
  })
  assert.strictEqual(statusCode, 200)

  const logs = await body.text()
  assert.ok(
    logs.includes(
      'Service \\"main\\" depends on service \\"service-1\\", but it is defined and it will be started before it. Please check your configuration file.'
    )
  )
})
