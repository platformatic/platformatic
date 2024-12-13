'use strict'

const { deepStrictEqual, ok } = require('node:assert')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { loadConfig } = require('@platformatic/config')
const { features } = require('@platformatic/utils')
const { request } = require('undici')
const { buildServer, platformaticRuntime } = require('../..')
const { updateConfigFile, openLogsWebsocket, waitForLogs } = require('../helpers')
const { prepareRuntime } = require('./helper')

test('services are started with multiple workers even for the entrypoint when Node.js supports reusePort', async t => {
  const getPort = await import('get-port')
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const port = await getPort.default()

  // Give some time to the OS to release the port
  await sleep(1000)

  await updateConfigFile(configFile, contents => {
    contents.server = { port }
    contents.autoload = undefined
  })

  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    managementApiWebsocket.terminate()
  })

  const [workers, startMessages, stopMessages] = features.node.reusePort
    ? [
        5,
        [
          'Starting the worker 0 of the service "node"...',
          'Starting the worker 1 of the service "node"...',
          'Starting the worker 2 of the service "node"...',
          'Starting the worker 3 of the service "node"...',
          'Starting the worker 4 of the service "node"...'
        ],
        [
          'Stopping the worker 0 of the service "node"...',
          'Stopping the worker 1 of the service "node"...',
          'Stopping the worker 2 of the service "node"...',
          'Stopping the worker 3 of the service "node"...',
          'Stopping the worker 4 of the service "node"...'
        ]
      ]
    : [1, ['Starting the service "node"...'], ['Stopping the service "node"...']]

  const startMessagesPromise = waitForLogs(managementApiWebsocket, ...startMessages, 'Platformatic is now listening')

  const entryUrl = await app.start()
  await startMessagesPromise

  const usedWorkers = new Set()
  // Check that we get the response from different workers
  const promises = Array.from(Array(workers)).map(async () => {
    const res = await request(entryUrl + '/hello')
    const json = await res.body.json()

    deepStrictEqual(res.statusCode, 200)

    if (workers > 1) {
      const worker = res.headers['x-plt-worker-id']
      ok(worker.match(/^[01234]$/))

      usedWorkers.add(worker)
    }

    deepStrictEqual(json, { from: 'node' })
  })

  await Promise.all(promises)

  if (workers > 1) {
    ok(usedWorkers.size > 1)
  }

  const stopMessagesPromise = waitForLogs(managementApiWebsocket, ...stopMessages)

  await app.stop()
  await stopMessagesPromise
})
