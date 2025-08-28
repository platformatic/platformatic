import { deepStrictEqual, ok } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from './helpers.js'
import { waitForEvents } from './multiple-workers/helper.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should restart the process if it exceeded maximum threshold', async t => {
  const configFile = join(fixturesDir, 'configs', 'health-unhealthy.json')
  const server = await createRuntime(configFile)

  t.after(async () => {
    await server.close()
  })

  const events = []
  server.on('application:worker:health', event => {
    events.push(event)
  })

  const waitPromise = waitForEvents(
    server,
    { event: 'application:worker:unhealthy', application: 'db-app', worker: 0 },
    { event: 'application:worker:unhealthy', application: 'serviceApp', worker: 0 },
    { event: 'application:worker:unhealthy', application: 'with-logger', worker: 0 },
    { event: 'application:worker:unhealthy', application: 'multi-plugin-service', worker: 0 },
    { event: 'application:worker:starting', application: 'db-app', worker: 0 },
    { event: 'application:worker:starting', application: 'serviceApp', worker: 0 },
    { event: 'application:worker:starting', application: 'with-logger', worker: 0 },
    { event: 'application:worker:starting', application: 'multi-plugin-service', worker: 0 }
  )

  await server.start()
  await waitPromise

  deepStrictEqual(events.length, 4)
  ok(!events.some(e => !e.unhealthy))
})
