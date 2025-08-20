'use strict'

const { deepStrictEqual, ok } = require('node:assert')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')
const { createRuntime } = require('../helpers.js')
const { updateFile } = require('../helpers')
const { prepareRuntime, waitForEvents } = require('./helper')

test('can restart only crashed workers when they throw an exception during start', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await createRuntime(configFile, null, { isProduction: true })

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
  app.on('application:worker:start:error', payload => {
    errors.push(payload.error)
  })

  const eventsPromise = waitForEvents(app, { event: 'application:worker:start:error', application: 'node', worker: 0 })

  await client.request({ method: 'POST', path: '/api/v1/applications/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/applications/node/start' })
  await client.close()

  await eventsPromise

  deepStrictEqual(errors.length, 6)
  deepStrictEqual(errors[0].message, 'kaboom')
})

test('can restart only crashed workers when they exit during start', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await createRuntime(configFile, null, { isProduction: true })

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
  app.on('application:worker:start:error', payload => {
    errors.push(payload.error)
  })

  const eventsPromise = waitForEvents(app, { event: 'application:worker:start:error', application: 'node', worker: 0 })

  await client.request({ method: 'POST', path: '/api/v1/applications/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/applications/node/start' })
  await client.close()

  await eventsPromise

  deepStrictEqual(errors.length, 6)
  deepStrictEqual(errors[0].message, 'The worker 0 of the application "node" exited prematurely with error code 1')
})

test('can restart only crashed workers when they crash', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await createRuntime(configFile, null, { isProduction: true })

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
  app.on('application:worker:error', payload => {
    errors.push(payload)
  })

  const eventsPromise = waitForEvents(
    app,
    { event: 'application:worker:error', application: 'node', worker: 0 },
    { event: 'application:worker:error', application: 'node', worker: 2 },
    { event: 'application:worker:error', application: 'node', worker: 4 }
  )

  await client.request({ method: 'POST', path: '/api/v1/applications/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/applications/node/start' })
  await client.close()

  await eventsPromise

  ok(errors.find(e => e.application === 'node' && e.worker === 0))
  ok(errors.find(e => e.application === 'node' && e.worker === 2))
  ok(errors.find(e => e.application === 'node' && e.worker === 4))
  ok(!errors.find(e => e.application === 'node' && e.worker === 1))
  ok(!errors.find(e => e.application === 'node' && e.worker === 3))
})

test('can restart only crashed workers when they exit', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await createRuntime(configFile, null, { isProduction: true })

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
  app.on('application:worker:error', payload => {
    errors.push(payload)
  })

  const eventsPromise = waitForEvents(
    app,
    { event: 'application:worker:error', application: 'node', worker: 0 },
    { event: 'application:worker:error', application: 'node', worker: 2 },
    { event: 'application:worker:error', application: 'node', worker: 4 }
  )

  await client.request({ method: 'POST', path: '/api/v1/applications/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/applications/node/start' })
  await client.close()

  await eventsPromise

  ok(errors.find(e => e.application === 'node' && e.worker === 0))
  ok(errors.find(e => e.application === 'node' && e.worker === 2))
  ok(errors.find(e => e.application === 'node' && e.worker === 4))
  ok(!errors.find(e => e.application === 'node' && e.worker === 1))
  ok(!errors.find(e => e.application === 'node' && e.worker === 3))
})
