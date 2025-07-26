'use strict'

const { deepStrictEqual, ok } = require('node:assert')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')
const { create } = require('../..')
const { updateFile, setLogFile } = require('../helpers')
const { prepareRuntime, waitForEvents } = require('./helper')

test.beforeEach(setLogFile)

test('can restart only crashed workers when they throw an exception during start', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await create(configFile, null, { isProduction: true })

  t.after(async () => {
    await app.close()
  })

  await app.start()

  await updateFile(resolve(root, 'node/index.mjs'), () => {
    return "throw new Error('kaboom')"
  })

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  const errors = []
  app.on('service:worker:start:error', payload => {
    errors.push(payload.error)
  })

  const eventsPromise = waitForEvents(app, { event: 'service:worker:start:error', service: 'node', worker: 0 })

  await client.request({ method: 'POST', path: '/api/v1/services/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/services/node/start' })
  await client.close()

  await eventsPromise

  deepStrictEqual(errors.length, 6)
  deepStrictEqual(errors[0].message, 'kaboom')
})

test('can restart only crashed workers when they exit during start', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await create(configFile, null, { isProduction: true })

  t.after(async () => {
    await app.close()
  })

  await app.start()

  await updateFile(resolve(root, 'node/index.mjs'), () => {
    return 'process.exit(1)'
  })

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  const errors = []
  app.on('service:worker:start:error', payload => {
    errors.push(payload.error)
  })

  const eventsPromise = waitForEvents(app, { event: 'service:worker:start:error', service: 'node', worker: 0 })

  await client.request({ method: 'POST', path: '/api/v1/services/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/services/node/start' })
  await client.close()

  await eventsPromise

  deepStrictEqual(errors.length, 6)
  deepStrictEqual(errors[0].message, 'The worker 0 of the service "node" exited prematurely with error code 1')
})

test('can restart only crashed workers when they crash', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await create(configFile, null, { isProduction: true })

  t.after(async () => {
    await app.close()
  })

  await app.start()

  await updateFile(resolve(root, 'node/index.mjs'), contents => {
    return (
      contents +
      "\n\nif(globalThis.platformatic.workerId % 2 === 0) { setTimeout(() => { throw new Error('kaboom') }, 250) }"
    )
  })

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  const errors = []
  app.on('service:worker:error', payload => {
    errors.push(payload)
  })

  const eventsPromise = waitForEvents(
    app,
    { event: 'service:worker:error', service: 'node', worker: 0 },
    { event: 'service:worker:error', service: 'node', worker: 2 },
    { event: 'service:worker:error', service: 'node', worker: 4 }
  )

  await client.request({ method: 'POST', path: '/api/v1/services/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/services/node/start' })
  await client.close()

  await eventsPromise

  ok(errors.find(e => e.service === 'node' && e.worker === 0))
  ok(errors.find(e => e.service === 'node' && e.worker === 2))
  ok(errors.find(e => e.service === 'node' && e.worker === 4))
  ok(!errors.find(e => e.service === 'node' && e.worker === 1))
  ok(!errors.find(e => e.service === 'node' && e.worker === 3))
})

test('can restart only crashed workers when they exit', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await create(configFile, null, { isProduction: true })

  t.after(async () => {
    await app.close()
  })

  await app.start()

  await updateFile(resolve(root, 'node/index.mjs'), contents => {
    return (
      contents + '\n\nif(globalThis.platformatic.workerId % 2 === 0) { setTimeout(() => { process.exit(1) }, 250) }'
    )
  })

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  const errors = []
  app.on('service:worker:error', payload => {
    errors.push(payload)
  })

  const eventsPromise = waitForEvents(
    app,
    { event: 'service:worker:error', service: 'node', worker: 0 },
    { event: 'service:worker:error', service: 'node', worker: 2 },
    { event: 'service:worker:error', service: 'node', worker: 4 }
  )

  await client.request({ method: 'POST', path: '/api/v1/services/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/services/node/start' })
  await client.close()

  await eventsPromise

  ok(errors.find(e => e.service === 'node' && e.worker === 0))
  ok(errors.find(e => e.service === 'node' && e.worker === 2))
  ok(errors.find(e => e.service === 'node' && e.worker === 4))
  ok(!errors.find(e => e.service === 'node' && e.worker === 1))
  ok(!errors.find(e => e.service === 'node' && e.worker === 3))
})
