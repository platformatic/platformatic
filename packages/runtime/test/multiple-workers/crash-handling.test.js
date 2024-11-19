'use strict'

const { ok, deepStrictEqual } = require('node:assert')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const { updateFile, openLogsWebsocket, waitForLogs } = require('../helpers')
const { prepareRuntime } = require('./helper')

test('can restart only crashed workers when they throw an exception during start', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    managementApiWebsocket.terminate()
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

  const waitPromise = waitForLogs(
    managementApiWebsocket,
    'Stopping the worker 0 of the service "node"...',
    'Failed to start worker 0 of the service "node" after 5 attempts.'
  )

  await client.request({ method: 'POST', path: '/api/v1/services/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/services/node/start' })
  await client.close()

  const messages = await waitPromise

  deepStrictEqual(
    messages.filter(m => m.msg === 'Failed to start worker 0 of the service "node".' && m.err?.message === 'kaboom')
      .length,
    6
  )

  for (let i = 1; i <= 5; i++) {
    ok(
      messages.find(
        m =>
          m.msg === `Attempt ${i} of 5 to start the worker 0 of the service "node" again will be performed in 500ms ...`
      )
    )
  }

  managementApiWebsocket.terminate()
})

test('can restart only crashed workers when they exit during start', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    managementApiWebsocket.terminate()
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

  const waitPromise = waitForLogs(
    managementApiWebsocket,
    'Stopping the worker 0 of the service "node"...',
    'Failed to start worker 0 of the service "node" after 5 attempts.'
  )

  await client.request({ method: 'POST', path: '/api/v1/services/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/services/node/start' })
  client.close()

  const messages = await waitPromise

  deepStrictEqual(
    messages.filter(
      m =>
        m.msg === 'Failed to start worker 0 of the service "node".' &&
        m.err?.message === 'The worker 0 of the service "node" exited prematurely with error code 1'
    ).length,
    6
  )

  for (let i = 1; i <= 5; i++) {
    ok(
      messages.find(
        m =>
          m.msg === `Attempt ${i} of 5 to start the worker 0 of the service "node" again will be performed in 500ms ...`
      )
    )
  }

  managementApiWebsocket.terminate()
})

test('can restart only crashed workers when they crash', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    managementApiWebsocket.terminate()
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

  const waitPromise = waitForLogs(
    managementApiWebsocket,
    'The worker 0 of the service "node" threw an uncaught exception.',
    'The worker 2 of the service "node" threw an uncaught exception.',
    'The worker 4 of the service "node" threw an uncaught exception.',
    'The worker 0 of the service "node" unexpectedly exited with code 1.',
    'The worker 2 of the service "node" unexpectedly exited with code 1.',
    'The worker 4 of the service "node" unexpectedly exited with code 1.',
    'The worker 0 of the service "node" will be restarted in 500ms...',
    'The worker 2 of the service "node" will be restarted in 500ms...',
    'The worker 4 of the service "node" will be restarted in 500ms...'
  )

  await client.request({ method: 'POST', path: '/api/v1/services/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/services/node/start' })
  client.close()

  const messages = await waitPromise

  ok(
    messages.find(
      m => m.msg === 'The worker 0 of the service "node" threw an uncaught exception.' && m.err?.message === 'kaboom'
    )
  )
  ok(
    messages.find(
      m => m.msg === 'The worker 2 of the service "node" threw an uncaught exception.' && m.err?.message === 'kaboom'
    )
  )
  ok(
    messages.find(
      m => m.msg === 'The worker 4 of the service "node" threw an uncaught exception.' && m.err?.message === 'kaboom'
    )
  )

  ok(!messages.find(m => m.msg === 'The worker 1 of the service "node" threw an uncaught exception.'))
  ok(!messages.find(m => m.msg === 'The worker 3 of the service "node" threw an uncaught exception.'))
  ok(!messages.find(m => m.msg === 'The worker 1 of the service "node" will be restarted in 500ms...'))
  ok(!messages.find(m => m.msg === 'The worker 3 of the service "node" will be restarted in 500ms..'))

  managementApiWebsocket.terminate()
})

test('can restart only crashed workers when they exit', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    managementApiWebsocket.terminate()
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

  const waitPromise = waitForLogs(
    managementApiWebsocket,
    'The worker 0 of the service "node" unexpectedly exited with code 1.',
    'The worker 2 of the service "node" unexpectedly exited with code 1.',
    'The worker 4 of the service "node" unexpectedly exited with code 1.',
    'The worker 0 of the service "node" will be restarted in 500ms...',
    'The worker 2 of the service "node" will be restarted in 500ms...',
    'The worker 4 of the service "node" will be restarted in 500ms...'
  )

  await client.request({ method: 'POST', path: '/api/v1/services/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/services/node/start' })
  client.close()

  const messages = await waitPromise

  ok(!messages.find(m => m.msg === 'The worker 1 of the service "node" unexpectedly exited with code 1.'))
  ok(!messages.find(m => m.msg === 'The worker 3 of the service "node" unexpectedly exited with code 1.'))
  ok(!messages.find(m => m.msg === 'The worker 1 of the service "node" will be restarted in 500ms...'))
  ok(!messages.find(m => m.msg === 'The worker 3 of the service "node" will be restarted in 500ms..'))

  managementApiWebsocket.terminate()
})
