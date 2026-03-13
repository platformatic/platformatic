import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { createRuntime, updateFile } from '../helpers.js'
import { prepareRuntime, waitForEvents } from './helper.js'

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

  const update = await updateFile(resolve(root, 'node/index.mjs'), contents => {
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

  // Track started workers to verify restarted workers get new indices
  const startedWorkers = []
  app.on('application:worker:started', payload => {
    startedWorkers.push(payload)
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

  update.revert()

  // Restarted workers get new unique indices (5, 6, 7) instead of reusing old ones (0, 2, 4)
  // Note: there are 5 initial workers (0-4), so next index starts at 5
  await waitForEvents(
    app,
    { event: 'application:worker:started', application: 'node', worker: 5 },
    { event: 'application:worker:started', application: 'node', worker: 6 },
    { event: 'application:worker:started', application: 'node', worker: 7 }
  )

  // Verify that the crashed workers were 0, 2, 4 (even indices)
  ok(errors.find(e => e.application === 'node' && e.worker === 0))
  ok(errors.find(e => e.application === 'node' && e.worker === 2))
  ok(errors.find(e => e.application === 'node' && e.worker === 4))
  ok(!errors.find(e => e.application === 'node' && e.worker === 1))
  ok(!errors.find(e => e.application === 'node' && e.worker === 3))

  // Verify that restarted workers got new unique indices >= 5
  const restartedWorkers = startedWorkers.filter(w => w.application === 'node' && w.worker >= 5)
  deepStrictEqual(restartedWorkers.length, 3, 'Should have 3 restarted workers with new indices')
})

test('can restart only crashed workers when they exit', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await createRuntime(configFile, null, { isProduction: true })

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const update = await updateFile(resolve(root, 'node/index.mjs'), contents => {
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

  // Track started workers to verify restarted workers get new indices
  const startedWorkers = []
  app.on('application:worker:started', payload => {
    startedWorkers.push(payload)
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

  update.revert()

  // Restarted workers get new unique indices (5, 6, 7) instead of reusing old ones (0, 2, 4)
  // Note: there are 5 initial workers (0-4), so next index starts at 5
  await waitForEvents(
    app,
    { event: 'application:worker:started', application: 'node', worker: 5 },
    { event: 'application:worker:started', application: 'node', worker: 6 },
    { event: 'application:worker:started', application: 'node', worker: 7 }
  )

  // Verify that the crashed workers were 0, 2, 4 (even indices)
  ok(errors.find(e => e.application === 'node' && e.worker === 0))
  ok(errors.find(e => e.application === 'node' && e.worker === 2))
  ok(errors.find(e => e.application === 'node' && e.worker === 4))
  ok(!errors.find(e => e.application === 'node' && e.worker === 1))
  ok(!errors.find(e => e.application === 'node' && e.worker === 3))

  // Verify that restarted workers got new unique indices >= 5
  const restartedWorkers = startedWorkers.filter(w => w.application === 'node' && w.worker >= 5)
  deepStrictEqual(restartedWorkers.length, 3, 'Should have 3 restarted workers with new indices')
})
