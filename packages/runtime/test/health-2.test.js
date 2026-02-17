import { deepStrictEqual, ok } from 'node:assert'
import { platform } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from './helpers.js'
import { waitForEvents } from './multiple-workers/helper.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should restart the process if it exceeded maximum threshold', { skip: platform() === 'win32' }, async t => {
  const configFile = join(fixturesDir, 'health-unhealthy', 'platformatic.json')
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
    { event: 'application:worker:unhealthy', application: 'service-1', worker: 0 },
    { event: 'application:worker:unhealthy', application: 'service-2', worker: 0 },
    { event: 'application:worker:starting', application: 'service-1', worker: 0 },
    { event: 'application:worker:starting', application: 'service-2', worker: 0 },
    30_000
  )

  await server.start()
  await waitPromise

  deepStrictEqual(events.length, 2)
  ok(!events.some(e => !e.unhealthy))
})
