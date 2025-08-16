'use strict'

const { ok } = require('node:assert')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { features } = require('@platformatic/foundation')
const { createRuntime } = require('../helpers.js')
const { updateFile, updateConfigFile } = require('../helpers')
const { prepareRuntime, getExpectedEvents, waitForEvents } = require('./helper')

test('services are started with multiple workers according to the configuration', async t => {
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

  ok(!startEvents.has('event=service:worker:stopped, service=service, worker=3'))
  ok(!startEvents.has('event=service:worker:stopped, service=service, worker=4'))

  const stopEventsPromise = waitForEvents(app, expectedEvents.stop)
  await app.stop()
  await stopEventsPromise
})

test('services are started with a single workers when no workers information is specified in the files', async t => {
  const root = await prepareRuntime(t, 'no-multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')

  await updateConfigFile(configFile, contents => {
    delete contents.workers
    delete contents.services[0].workers
  })

  const app = await createRuntime(configFile, null, { isProduction: true })

  const events = []
  app.on('service:worker:started', payload => {
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
test('can detect changes and restart all workers for a service', async t => {
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
    { event: 'service:worker:changed', service: 'node', worker: 0 },
    { event: 'service:worker:started', service: 'node', worker: 0 }
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

  const servicesMetrics = metrics.filter(s => {
    const firstValue = s.values[0]

    if (!firstValue) {
      return false
    }

    return 'serviceId' in firstValue.labels && 'workerId' in firstValue.labels
  })

  const received = new Set()
  ok(
    servicesMetrics.every(s => {
      const firstValue = s.values[0]
      const serviceId = firstValue?.labels?.['serviceId']
      const workerId = firstValue?.labels?.['workerId']

      received.add(`${serviceId}:${workerId}`)
      switch (serviceId) {
        case 'composer':
          if (features.node.reusePort) {
            return typeof workerId === 'number' && workerId >= 0 && workerId < 3
          } else {
            return workerId === 0 || typeof workerId === 'undefined'
          }

        case 'service':
          return typeof workerId === 'number' && workerId >= 0 && workerId < 3
        case 'node':
          return typeof workerId === 'number' && workerId >= 0 && workerId < 5
        default:
          // No serviceId, all good
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
    'service:0',
    'service:1',
    'service:2'
  ])
})
