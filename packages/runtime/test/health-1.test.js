import autocannon from 'autocannon'
import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime, readLogs } from './helpers.js'
import { waitForEvents } from './multiple-workers/helper.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should continously monitor workers health', async t => {
  const configFile = join(fixturesDir, 'configs', 'health-healthy.json')
  const server = await createRuntime(configFile)

  await server.start()

  t.after(() => {
    return server.close()
  })

  for (let i = 0; i < 3; i++) {
    await once(server, 'application:worker:health')
  }
})

test('should not lose any connection when restarting the process', async t => {
  const configFile = join(fixturesDir, 'health-check-swapping', 'platformatic.json')
  const context = {}

  const server = await createRuntime(configFile, null, context)

  t.after(async () => {
    await server.close()
  })

  const waitPromise = waitForEvents(server, {
    event: 'application:worker:unhealthy',
    application: 'service',
    worker: 0
  })
  const url = await server.start()

  // Start hammering the application with autocannon
  const results = await autocannon({ url: `${url}/service/`, connections: 10, duration: 10 })

  // Wait for messages
  await waitPromise
  const messages = await readLogs(context.logsPath)

  ok(messages.some(m => m.msg === 'The worker 0 of the application "service" is unhealthy. Replacing it ...'))
  ok(!messages.some(m => m.msg === 'The worker 0 of the application "service" unexpectedly exited with code 1.'))
  ok(!messages.some(m => m.error?.message.includes('No target found for application.plt.local')))
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

  await sleep(10000)

  const applicationEvents = events.filter(e => e.application === 'serviceApp')
  ok(applicationEvents.length > 8, `Expected more than 8 events, got ${applicationEvents.length}`)
})
