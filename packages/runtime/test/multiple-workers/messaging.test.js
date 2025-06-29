'use strict'

const { loadConfig } = require('@platformatic/config')
const { deepStrictEqual } = require('node:assert')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { buildServer, platformaticRuntime } = require('../..')
const { kWorkersBroadcast } = require('../../lib/worker/symbols')
const { prepareRuntime, waitForEvents } = require('./helper')
const { updateFile, setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

function waitBroadcastedWorkers (t, allowedEmptyEvents = 0, multipleThreads = false) {
  const threads = {}

  return new Promise(resolve => {
    const broadcast = new BroadcastChannel(kWorkersBroadcast)
    t.after(() => {
      broadcast.close()
    })

    const events = []
    broadcast.onmessage = function ({ data }) {
      events.push(data)

      for (const values of data.values()) {
        for (const worker of values) {
          if (multipleThreads) {
            threads[worker.id] ??= []
            threads[worker.id].push(worker.thread)
          } else {
            threads[worker.id] = worker.thread
          }
        }
      }

      if (data.size === 0) {
        allowedEmptyEvents--

        if (allowedEmptyEvents < 0) {
          resolve({ threads, events })
          broadcast.close()
        }
      }
    }
  })
}

test('should post updated workers list via broadcast channel', async t => {
  const root = await prepareRuntime(t, 'messaging', { first: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const eventsPromise = waitBroadcastedWorkers(t)

  t.after(async () => {
    await app.close()
  })

  await app.start()
  await app.stop()

  const { events, threads } = await eventsPromise

  // Verify that the broadcast happened in the right order

  const expected = { first: [{ id: 'first:0', service: 'first', thread: threads['first:0'], worker: 0 }] }
  deepStrictEqual(events[0], new Map(Object.entries(expected)))

  expected.first.push({ id: 'first:1', service: 'first', thread: threads['first:1'], worker: 1 })
  deepStrictEqual(events[1], new Map(Object.entries(expected)))

  expected.first.push({ id: 'first:2', service: 'first', thread: threads['first:2'], worker: 2 })
  deepStrictEqual(events[2], new Map(Object.entries(expected)))

  expected.second = [{ id: 'second:0', service: 'second', thread: threads['second:0'], worker: 0 }]
  deepStrictEqual(events[3], new Map(Object.entries(expected)))

  expected.second.push({ id: 'second:1', service: 'second', thread: threads['second:1'], worker: 1 })
  deepStrictEqual(events[4], new Map(Object.entries(expected)))

  expected.second.push({ id: 'second:2', service: 'second', thread: threads['second:2'], worker: 2 })
  deepStrictEqual(events[5], new Map(Object.entries(expected)))

  expected.composer = [{ id: 'composer', service: 'composer', thread: threads['composer'], worker: undefined }]
  deepStrictEqual(events[6], new Map(Object.entries(expected)))

  delete expected.composer
  deepStrictEqual(events[7], new Map(Object.entries(expected)))

  expected.second.shift()
  deepStrictEqual(events[8], new Map(Object.entries(expected)))

  expected.second.shift()
  deepStrictEqual(events[9], new Map(Object.entries(expected)))

  delete expected.second
  deepStrictEqual(events[10], new Map(Object.entries(expected)))

  expected.first.shift()
  deepStrictEqual(events[11], new Map(Object.entries(expected)))

  expected.first.shift()
  deepStrictEqual(events[12], new Map(Object.entries(expected)))

  deepStrictEqual(events[13], new Map())
})

test('should post updated workers when something crashed', async t => {
  const root = await prepareRuntime(t, 'messaging', { first: ['node'] })
  const configFile = resolve(root, './platformatic.first-only.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const eventsPromise = waitBroadcastedWorkers(t, 1, true)

  t.after(async () => {
    await app.close()
  })

  const url = await app.start()

  const waitPromise = waitForEvents(
    app,
    { event: 'service:worker:error', service: 'first', worker: 0 },
    { event: 'service:worker:started', service: 'first', worker: 0 }
  )

  // Fetch the entrypoint to induce the crash
  {
    const res = await request(`${url}/crash`)
    deepStrictEqual(res.statusCode, 200)
  }

  // Wait for the application to restart
  await waitPromise
  await app.stop()

  const { events, threads } = await eventsPromise

  // Verify that the broadcast happened in the right order
  deepStrictEqual(events, [
    new Map([['first', [{ id: 'first', service: 'first', thread: threads['first'][0], worker: undefined }]]]),
    new Map(),
    new Map([['first', [{ id: 'first', service: 'first', thread: threads['first'][1], worker: undefined }]]]),
    new Map()
  ])
})

test('should post updated workers when the service is updated', async t => {
  const root = await prepareRuntime(t, 'messaging', { first: ['node'] })
  const configFile = resolve(root, './platformatic.first-only.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const eventsPromise = waitBroadcastedWorkers(t, 1, true)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const waitPromise = waitForEvents(app, { event: 'service:worker:reloaded', service: 'first', worker: 0 })

  await updateFile(resolve(root, './first/index.mjs'), contents => {
    contents = contents.replace('function create', 'function main').replace('return app', 'app.listen({ port: 0 })')
    return contents + '\nmain()'
  })

  // Wait for the application to restart
  await waitPromise
  await app.stop()

  const { events, threads } = await eventsPromise

  // Verify that the broadcast happened in the right order
  deepStrictEqual(events, [
    new Map([['first', [{ id: 'first', service: 'first', thread: threads['first'][0], worker: undefined }]]]),
    new Map(),
    new Map([['first', [{ id: 'first', service: 'first', thread: threads['first'][1], worker: undefined }]]]),
    new Map()
  ])
})

test('should get information from other workers via ITC using a round robin approach', async t => {
  const root = await prepareRuntime(t, 'messaging', { first: ['node'] })
  const configFile = resolve(root, './platformatic.1-to-n.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  const threads = {}
  const broadcast = new BroadcastChannel(kWorkersBroadcast)
  broadcast.onmessage = function (event) {
    const data = event.data

    for (const values of data.values()) {
      for (const worker of values) {
        threads[`T${worker.thread}`] = worker.id
      }
    }
  }

  t.after(async () => {
    await app.close()
    broadcast.close()
  })

  const url = await app.start()

  let firstWorker
  const responses = []
  {
    const res = await request(`${url}/first/thread/12345`)

    deepStrictEqual(res.statusCode, 200)
    const response = await res.body.json()

    // Check we get response from the workers in order
    firstWorker = threads[response.thread]
    responses.push(firstWorker)
  }

  {
    const res = await request(`${url}/first/thread/12345`)
    deepStrictEqual(res.statusCode, 200)
    const response = await res.body.json()
    responses.push(threads[response.thread])
  }

  {
    const res = await request(`${url}/first/thread/12345`)
    deepStrictEqual(res.statusCode, 200)
    const response = await res.body.json()
    responses.push(threads[response.thread])
  }

  {
    const res = await request(`${url}/first/thread/12345`)
    deepStrictEqual(res.statusCode, 200)
    const response = await res.body.json()
    responses.push(threads[response.thread])
  }

  const firstId = parseInt(firstWorker.split(':')[1])

  deepStrictEqual(responses, [
    `second:${firstId}`,
    `second:${(firstId + 1) % 3}`,
    `second:${(firstId + 2) % 3}`,
    `second:${(firstId + 0) % 3}`
  ])
})

test('should return an error if the target worker throws an error', async t => {
  const root = await prepareRuntime(t, 'messaging', { first: ['node'] })
  const configFile = resolve(root, './platformatic.1-to-n.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
  })

  await updateFile(resolve(root, './second/plugin.js'), contents => {
    return contents.replace('async thread () {', "async thread () {\nthrow new Error('Handler Kaboom!')")
  })

  const url = await app.start()

  {
    const res = await request(`${url}/first/thread/12345`)
    deepStrictEqual(res.statusCode, 500)
    const error = await res.body.json()

    deepStrictEqual(error.message, 'Handler failed with error: Handler Kaboom!')
  }
})

test('should return an error if the target worker times out', async t => {
  const root = await prepareRuntime(t, 'messaging', { first: ['node'] })
  const configFile = resolve(root, './platformatic.1-to-n.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
  })

  await updateFile(resolve(root, './second/plugin.js'), contents => {
    return contents.replace(
      'async thread () {',
      `
        async thread () {
        await require('node:timers/promises').setTimeout(5000)
      `
    )
  })

  const url = await app.start()

  {
    const res = await request(`${url}/first/thread/12345`)
    deepStrictEqual(res.statusCode, 500)
    const error = await res.body.json()

    deepStrictEqual(error.message, 'Cannot send a message to service "second": Timeout while waiting for a response.')
  }
})

test('should return an error if the target worker exits before returning a response', async t => {
  const root = await prepareRuntime(t, 'messaging', { first: ['node'] })
  const configFile = resolve(root, './platformatic.1-to-n.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
  })

  await updateFile(resolve(root, './second/plugin.js'), contents => {
    return contents.replace('async thread () {', 'async thread () {\nprocess.exit(1)')
  })

  const url = await app.start()

  {
    const res = await request(`${url}/first/thread/12345`)
    deepStrictEqual(res.statusCode, 500)
    const error = await res.body.json()

    deepStrictEqual(
      error.message,
      'Cannot send a message to service "second": The communication channel was closed before receiving a response.'
    )
  }
})

test('should return an error if the target worker throws an error while saving the channel', async t => {
  const root = await prepareRuntime(t, 'messaging', { first: ['node'] })
  const configFile = resolve(root, './platformatic.1-to-n.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
  })

  await updateFile(resolve(root, './second/plugin.js'), contents => {
    return contents.replace(
      'module.exports = async function (app) {',
      `
        module.exports = async function (app) {
          globalThis[Symbol.for('plt.runtime.itc')].handle('saveMessagingChannel', function () {
            throw new Error('Kaboom!')
          })
        \n
      `
    )
  })

  const url = await app.start()

  {
    const res = await request(`${url}/first/thread/12345`)
    deepStrictEqual(res.statusCode, 500)
    const error = await res.body.json()

    deepStrictEqual(error.message, 'Handler failed with error: Kaboom!')
  }
})

test('should return an error if the target worker times out while saving the channel', async t => {
  const root = await prepareRuntime(t, 'messaging', { first: ['node'] })
  const configFile = resolve(root, './platformatic.1-to-n.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
  })

  await updateFile(resolve(root, './second/plugin.js'), contents => {
    return contents.replace(
      'module.exports = async function (app) {',
      `
        module.exports = async function (app) {
          const existingHandler = globalThis[Symbol.for('plt.runtime.itc')].getHandler('saveMessagingChannel')
          
          globalThis[Symbol.for('plt.runtime.itc')].handle('saveMessagingChannel', async function (...args) {
            await require('node:timers/promises').setTimeout(5000)
            return existingHandler(...args)            
          })
        \n
      `
    )
  })

  const url = await app.start()

  {
    const res = await request(`${url}/first/thread/12345`)
    deepStrictEqual(res.statusCode, 500)
    const error = await res.body.json()

    deepStrictEqual(
      error.message,
      'Handler failed with error: Cannot send a message to service "second": Timeout while establishing a communication channel.'
    )
  }
})

test('should reuse channels when the worker are restarted', async t => {
  const root = await prepareRuntime(t, 'messaging', { first: ['node'] })
  const configFile = resolve(root, './platformatic.with-watch.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
  })

  let createdChannels = 0
  app.on('service:worker:messagingChannel', () => createdChannels++)

  const url = await app.start()

  // Fetch the entrypoint to create the channels. Let's do four times to have one reused
  for (let i = 0; i < 4; i++) {
    const res = await request(`${url}/first/thread/12345`)
    deepStrictEqual(res.statusCode, 200)
  }

  deepStrictEqual(createdChannels, 3)

  // Get all the logs so far
  const waitPromise = waitForEvents(app, { event: 'service:worker:reloaded', service: 'third', worker: 0 })

  // Now restart the third service, it should result in workers configuration being broadcasted
  await updateFile(resolve(root, './third/index.mjs'), contents => {
    return contents.replace("{ hello: 'world' }", "{ from: 'third' }")
  })

  // Wait for the application to restart
  await waitPromise

  // Fetch the entrypoint again, no new channels should be created
  for (let i = 0; i < 4; i++) {
    const res = await request(`${url}/first/thread/12345`)
    deepStrictEqual(res.statusCode, 200)
  }

  deepStrictEqual(createdChannels, 3)
})
