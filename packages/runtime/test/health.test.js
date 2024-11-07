'use strict'

const { ok, strictEqual } = require('node:assert')
const { once } = require('node:events')
const { join } = require('node:path')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { Client } = require('undici')
const { buildServer, loadConfig } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')

test.only('should continously monitor workers health', async t => {
  const configFile = join(fixturesDir, 'configs', 'health-healthy.json')
  const config = await loadConfig({}, ['-c', configFile])

  const server = await buildServer({
    app: config.app,
    ...config.configManager.current
  })

  await server.start()

  t.after(() => {
    return server.close()
  })

  for (let i = 0; i < 3; i++) {
    process._rawDebug(await once(server, 'health'))
  }
})

test('should restart the process if it exceeded maximum threshold', async t => {
  const configFile = join(fixturesDir, 'configs', 'health-unhealthy.json')
  const config = await loadConfig({}, ['-c', configFile])

  const server = await buildServer({
    app: config.app,
    ...config.configManager.current
  })

  t.after(() => {
    return server.close()
  })

  await server.start()

  await sleep(3000)

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: server.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  await sleep(3000)

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/all'
  })

  strictEqual(statusCode, 200)

  const messages = (await body.text())
    .trim()
    .split('\n')
    .map(l => {
      return JSON.parse(l).msg
    })

  for (const service of ['db-app', 'serviceApp', 'with-logger', 'multi-plugin-service']) {
    ok(messages.includes(`The service "${service}" is unhealthy. Forcefully terminating it ...`))
    ok(messages.includes(`The service "${service}" unexpectedly exited with code 1.`))
  }

  process._rawDebug('ALL GOOD')
})
