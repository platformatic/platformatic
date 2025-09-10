'use strict'

const { ok, deepStrictEqual, strictEqual } = require('node:assert')
const { once } = require('node:events')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const autocannon = require('autocannon')
const { safeRemove } = require('@platformatic/utils')
const { buildServer, loadConfig } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')
const { openLogsWebsocket, waitForLogs } = require('./helpers')
const { request } = require('undici')

test('should continously monitor workers health', async t => {
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
    await once(server, 'health')
  }
})

test('should not lose any connection when restarting the process', async t => {
  const configFile = join(fixturesDir, 'health-check-swapping', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile])

  const originalEnv = process.env.PLT_RUNTIME_LOGGER_STDOUT
  process.env.PLT_RUNTIME_LOGGER_STDOUT = join(tmpdir(), `test-runtime-${process.pid}-${Date.now()}-stdout.log`)

  t.after(async () => {
    await safeRemove(process.env.PLT_RUNTIME_LOGGER_STDOUT)

    if (typeof originalEnv === 'undefined') {
      delete process.env.PLT_RUNTIME_LOGGER_STDOUT
    } else {
      process.env.PLT_RUNTIME_LOGGER_STDOUT = originalEnv
    }
  })

  const server = await buildServer({
    app: config.app,
    ...config.configManager.current
  })

  const managementApiWebsocket = await openLogsWebsocket(server)

  t.after(async () => {
    await server.close()
    managementApiWebsocket.terminate()
  })

  const waitPromise = waitForLogs(
    managementApiWebsocket,
    'Platformatic is now listening',
    'The service "service" is unhealthy. Replacing it ...'
  )
  const url = await server.start()

  // Start hammering the service with autocannon
  const results = await autocannon({ url: `${url}/service/`, connections: 10, duration: 10 })

  // Wait for messages
  const rawMessages = await waitPromise
  const messages = rawMessages.map(m => m.msg)

  ok(messages.includes('The service "service" is unhealthy. Replacing it ...'))
  ok(!messages.includes('The service "service" unexpectedly exited with code 1.'))
  ok(!rawMessages.some(m => m.error?.message.includes('No target found for service.plt.local')))
  ok(!rawMessages.some(m => m.error?.code === 'FST_REPLY_FROM_INTERNAL_SERVER_ERROR'))
  deepStrictEqual(results.errors, 0)
  deepStrictEqual(results.non2xx, 0)
})

test('set the spaces memory correctly', async t => {
  const configFile = join(fixturesDir, 'health-spaces', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile])

  const server = await buildServer({
    app: config.app,
    ...config.configManager.current
  })

  const url = await server.start()

  t.after(() => {
    return server.close()
  })

  {
    const res = await request(url + '/')

    const { resourceLimits } = await res.body.json()
    strictEqual(resourceLimits.maxOldGenerationSizeMb, 192)
    strictEqual(resourceLimits.maxYoungGenerationSizeMb, 64)
  }
})

test('set the spaces memory correctly when maxHeapTotal is a string', async t => {
  const configFile = join(fixturesDir, 'health-spaces-heap-string', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile])

  const server = await buildServer({
    app: config.app,
    ...config.configManager.current
  })

  const url = await server.start()

  t.after(() => {
    return server.close()
  })

  {
    const res = await request(url + '/')

    const { resourceLimits } = await res.body.json()
    strictEqual(resourceLimits.maxOldGenerationSizeMb, 192)
    strictEqual(resourceLimits.maxYoungGenerationSizeMb, 64)
  }
})

test('should continously monitor workers health', async t => {
  const configFile = join(fixturesDir, 'configs', 'health-grace-period.json')
  const server = await createRuntime(configFile)

  await server.start()

  t.after(() => {
    return server.close()
  })

  const start = Date.now()

  // Wait for the first health check
  await once(server, 'application:worker:health')

  const firstAlertTime = Date.now()

  const gracePeriodMs = firstAlertTime - start
  ok(gracePeriodMs > 4000, `Expected the grace period to be greater than 4000ms, got ${gracePeriodMs}`)

  const events = []
  server.on('application:worker:health', event => {
    events.push(event)
  })

  await sleep(5000)

  const applicationEvents = events.filter(e => e.application === 'serviceApp')
  ok(applicationEvents.length > 8, `Expected more than 8 events, got ${applicationEvents.length}`)
})
