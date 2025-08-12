'use strict'

const { ok, deepStrictEqual, strictEqual } = require('node:assert')
const { once } = require('node:events')
const { join } = require('node:path')
const { test } = require('node:test')
const autocannon = require('autocannon')
const { createRuntime } = require('./helpers.js')
const fixturesDir = join(__dirname, '..', 'fixtures')
const { waitForEvents } = require('./multiple-workers/helper')
const { request } = require('undici')
const { readLogs } = require('./helpers')

test('should continously monitor workers health', async t => {
  const configFile = join(fixturesDir, 'configs', 'health-healthy.json')
  const server = await createRuntime(configFile)

  await server.start()

  t.after(() => {
    return server.close()
  })

  for (let i = 0; i < 3; i++) {
    await once(server, 'service:worker:health')
  }
})

test('should restart the process if it exceeded maximum threshold', async t => {
  const configFile = join(fixturesDir, 'configs', 'health-unhealthy.json')
  const server = await createRuntime(configFile)

  t.after(async () => {
    await server.close()
  })

  const events = []
  server.on('service:worker:health', event => {
    events.push(event)
  })

  const waitPromise = waitForEvents(
    server,
    { event: 'service:worker:unhealthy', service: 'db-app', worker: 0 },
    { event: 'service:worker:unhealthy', service: 'serviceApp', worker: 0 },
    { event: 'service:worker:unhealthy', service: 'with-logger', worker: 0 },
    { event: 'service:worker:unhealthy', service: 'multi-plugin-service', worker: 0 },
    { event: 'service:worker:starting', service: 'db-app', worker: 0 },
    { event: 'service:worker:starting', service: 'serviceApp', worker: 0 },
    { event: 'service:worker:starting', service: 'with-logger', worker: 0 },
    { event: 'service:worker:starting', service: 'multi-plugin-service', worker: 0 }
  )

  await server.start()
  await waitPromise

  deepStrictEqual(events.length, 4)
  ok(!events.some(e => !e.unhealthy))
})

test('should not lose any connection when restarting the process', async t => {
  const configFile = join(fixturesDir, 'health-check-swapping', 'platformatic.json')
  const context = {}

  const server = await createRuntime(configFile, null, context)

  t.after(async () => {
    await server.close()
  })

  const waitPromise = waitForEvents(server, { event: 'service:worker:unhealthy', service: 'service', worker: 0 })
  const url = await server.start()

  // Start hammering the service with autocannon
  const results = await autocannon({ url: `${url}/service/`, connections: 10, duration: 10 })

  // Wait for messages
  await waitPromise
  const messages = await readLogs(context.testRuntimeRoot)

  ok(messages.some(m => m.msg === 'The service "service" is unhealthy. Replacing it ...'))
  ok(!messages.some(m => m.msg === 'The service "service" unexpectedly exited with code 1.'))
  ok(!messages.some(m => m.error?.message.includes('No target found for service.plt.local')))
  ok(!messages.some(m => m.error?.code === 'FST_REPLY_FROM_INTERNAL_SERVER_ERROR'))
  deepStrictEqual(results.errors, 0)
  deepStrictEqual(results.non2xx, 0)
})

test('set the spaces memory correctly', async t => {
  const configFile = join(fixturesDir, 'health-spaces', 'platformatic.json')
  const server = await createRuntime(configFile)

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
  const server = await createRuntime(configFile)

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
