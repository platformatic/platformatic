import { features } from '@platformatic/foundation'
import { ok, strictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { createRuntime, updateConfigFile, updateFile } from '../helpers.js'
import { getExpectedEvents, prepareRuntime, waitForEvents } from './helper.js'

test('applications are started with multiple workers according to the configuration', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await createRuntime(configFile, null, { isProduction: true })

  t.after(async () => {
    await app.close()
  })

  const expectedEvents = getExpectedEvents('composer', { composer: 3, service: 3, node: 5 })
  const startEventsPromise = waitForEvents(app, expectedEvents.start)

  await app.start()
  const startEvents = await startEventsPromise

  ok(!startEvents.has('event=application:worker:stopped, application=service, worker=3'))
  ok(!startEvents.has('event=application:worker:stopped, application=service, worker=4'))

  const stopEventsPromise = waitForEvents(app, expectedEvents.stop)
  await app.stop()
  await stopEventsPromise
})

test('applications are started with a single workers when no workers information is specified in the files', async t => {
  const root = await prepareRuntime(t, 'no-multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')

  await updateConfigFile(configFile, contents => {
    delete contents.workers
    delete contents.services[0].workers
  })

  const app = await createRuntime(configFile, null, { isProduction: true })

  const events = []
  app.on('application:worker:started', payload => {
    events.push(payload)
  })

  t.after(async () => {
    await app.close()
  })

  await app.start()
  await app.stop()

  ok(!events.some(e => e.workersCount > 1))
})

// Note: this cannot be tested in production mode as watching is always disabled
test('can detect changes and restart all workers for a application', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')

  await updateConfigFile(configFile, contents => {
    contents.watch = true
  })

  await updateConfigFile(resolve(root, 'node/platformatic.json'), contents => {
    contents.logger = { level: 'debug' }
    contents.watch = true
  })

  const app = await createRuntime(configFile, null)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const events = waitForEvents(
    app,
    { event: 'application:worker:changed', application: 'node', worker: 0 },
    { event: 'application:worker:started', application: 'node', worker: 0 }
  )

  await updateFile(resolve(root, 'node/index.mjs'), contents => {
    return contents.replace("{ from: 'node' }", "{ from: 'node-after-reload' }")
  })

  await events
})

test('can collect metrics with worker label', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await createRuntime(configFile, null, { isProduction: true })

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const { metrics } = await app.getMetrics()

  const applicationsMetrics = metrics.filter(s => {
    const firstValue = s.values[0]

    if (!firstValue) {
      return false
    }

    return 'applicationId' in firstValue.labels && 'workerId' in firstValue.labels
  })

  const received = new Set()
  ok(
    applicationsMetrics.every(s => {
      const firstValue = s.values[0]
      const applicationId = firstValue?.labels?.['applicationId']
      const workerId = firstValue?.labels?.['workerId']

      received.add(`${applicationId}:${workerId}`)
      switch (applicationId) {
        case 'composer':
          if (features.node.reusePort) {
            return typeof workerId === 'number' && workerId >= 0 && workerId < 3
          } else {
            return workerId === 0 || typeof workerId === 'undefined'
          }

        case 'application':
          return typeof workerId === 'number' && workerId >= 0 && workerId < 3
        case 'node':
          return typeof workerId === 'number' && workerId >= 0 && workerId < 5
        default:
          // No applicationId, all good
          return true
      }
    })
  )

  ok(Array.from(received).sort(), [
    'composer:0',
    'node:0',
    'node:1',
    'node:2',
    'node:3',
    'node:4',
    'application:0',
    'application:1',
    'application:2'
  ])
})

test('worker threads have correct threadName property set', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await createRuntime(configFile, null, { isProduction: true })

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const workers = await app.getWorkers(true)

  for (const [workerId, workerInfo] of Object.entries(workers)) {
    strictEqual(workerInfo.raw.threadName, workerId, `Worker ${workerId} should have threadName property set to its workerId`)
  }

  await app.stop()
})
