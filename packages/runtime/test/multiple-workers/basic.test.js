'use strict'

const { ok } = require('node:assert')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { loadConfig } = require('@platformatic/config')
const { features } = require('@platformatic/utils')
const { buildServer, platformaticRuntime } = require('../..')
const { updateFile, updateConfigFile, openLogsWebsocket, waitForLogs } = require('../helpers')
const { getExpectedMessages, prepareRuntime } = require('./helper')

test('services are started with multiple workers according to the configuration', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    managementApiWebsocket.terminate()
  })

  const expectedMessages = getExpectedMessages('composer', { composer: 3, service: 3, node: 5 })
  const waitPromise = waitForLogs(managementApiWebsocket, ...expectedMessages.start)

  await app.start()

  const startMessages = (await waitPromise).map(m => m.msg)

  if (features.node.reusePort) {
    ok(!startMessages.includes('Starting the service "composer"...'))
  } else {
    ok(!startMessages.includes('Starting the worker 0 of the service "composer"...'))
  }

  ok(!startMessages.includes('Starting the worker 3 of the service "service"...'))
  ok(!startMessages.includes('Starting the worker 4 of the service "service"...'))

  const stopMessagesPromise = waitForLogs(managementApiWebsocket, ...expectedMessages.stop)
  await app.stop()
  const stopMessages = (await stopMessagesPromise).map(m => m.msg)

  if (features.node.reusePort) {
    ok(!startMessages.includes('Stopping the service "composer"...'))
  } else {
    ok(!stopMessages.includes('Stopping the worker 0 of the service "composer"...'))
  }
})

test('services are started with a single workers when no workers information is specified in the files', async t => {
  const root = await prepareRuntime(t, 'no-multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')

  await updateConfigFile(configFile, contents => {
    delete contents.workers
    delete contents.services[0].workers
  })

  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)

  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    managementApiWebsocket.terminate()
  })

  const messagesPromise = waitForLogs(
    managementApiWebsocket,
    'Starting the service "service"...',
    'Starting the service "node"...',
    'Starting the service "composer"...',
    'Stopping the service "service"...',
    'Stopping the service "node"...',
    'Stopping the service "composer"...'
  )

  await app.start()
  await app.stop()
  const messages = (await messagesPromise).map(m => m.msg)

  ok(!messages.includes('Starting the worker 0 of the service "service"...'))
  ok(!messages.includes('Starting the worker 0 of the service "node"...'))
  ok(!messages.includes('Starting the worker 0 of the service "composer"...'))
})

// Note: this cannot be tested in production mode as watching is always disabled
test('can detect changes and restart all workers for a service', { only: true }, async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')

  await updateConfigFile(configFile, contents => {
    contents.watch = true
  })

  await updateConfigFile(resolve(root, 'node/platformatic.json'), contents => {
    contents.logger = { level: 'debug' }
    contents.watch = true
  })

  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    managementApiWebsocket.terminate()
  })

  const waitPromise1 = waitForLogs(
    managementApiWebsocket,
    'Starting the worker 0 of the service "node"...',
    'start watching files',
    'Platformatic is now listening'
  )

  await app.start()
  await waitPromise1

  const waitPromise2 = waitForLogs(
    managementApiWebsocket,
    'files changed',
    'Stopping the worker 0 of the service "node"...',
    'Starting the worker 0 of the service "node"...',
    'Service "node" has been successfully reloaded ...'
  )

  await updateFile(resolve(root, 'node/index.mjs'), contents => {
    return contents.replace("{ from: 'node' }", "{ from: 'node-after-reload' }")
  })

  await waitPromise2
})

test('can collect metrics with worker label', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)

  const app = await buildServer(config.configManager.current, config.args)

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
