'use strict'

const { deepStrictEqual, ok } = require('node:assert')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { features } = require('@platformatic/foundation')
const { request } = require('undici')
const { createRuntime } = require('../helpers.js')
const { updateConfigFile } = require('../helpers')
const { prepareRuntime, waitForEvents } = require('./helper')

test('applications are started with multiple workers even for the entrypoint when Node.js supports reusePort', async t => {
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

  const app = await createRuntime(configFile, null, { isProduction: true })

  t.after(async () => {
    await app.close()
  })

  const [workers, startMessages, stopMessages] = features.node.reusePort
    ? [
        5,
        [
          { event: 'application:worker:started', application: 'node', worker: 0 },
          { event: 'application:worker:started', application: 'node', worker: 1 },
          { event: 'application:worker:started', application: 'node', worker: 2 },
          { event: 'application:worker:started', application: 'node', worker: 3 },
          { event: 'application:worker:started', application: 'node', worker: 4 }
        ],
        [
          { event: 'application:worker:stopped', application: 'node', worker: 0 },
          { event: 'application:worker:stopped', application: 'node', worker: 1 },
          { event: 'application:worker:stopped', application: 'node', worker: 2 },
          { event: 'application:worker:stopped', application: 'node', worker: 3 },
          { event: 'application:worker:stopped', application: 'node', worker: 4 }
        ]
      ]
    : [1, [{ event: 'application:started', application: 'node' }], [{ event: 'application:stopped', application: 'node' }]]

  const startMessagesPromise = waitForEvents(app, startMessages)

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

  const stopMessagesPromise = waitForEvents(app, stopMessages)

  await app.stop()
  await stopMessagesPromise
})
