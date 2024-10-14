'use strict'

const { cp, symlink, readFile, writeFile } = require('node:fs/promises')
const { ok, deepStrictEqual } = require('node:assert')
const { on } = require('node:events')
const { platform } = require('node:os')
const { join, resolve } = require('node:path')
const { test } = require('node:test')
const WebSocket = require('ws')
const { Client, request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { createDirectory, safeRemove } = require('@platformatic/utils')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

const tmpDir = resolve(__dirname, '../../tmp')

async function prepareRuntime (name, dependencies) {
  const root = resolve(tmpDir, `plt-multiple-workers-${Date.now()}`)
  await createDirectory(root)
  await cp(resolve(fixturesDir, name), root, { recursive: true })

  for (const [service, deps] of Object.entries(dependencies)) {
    const depsRoot = resolve(root, service, 'node_modules/@platformatic')
    await createDirectory(depsRoot)

    for (const dep of deps) {
      await symlink(resolve(root, '../../../', dep), resolve(depsRoot, dep))
    }
  }

  process.env.PLT_RUNTIME_LOGGER_STDOUT = resolve(root, 'log.txt')
  return root
}

async function updateFile (path, update) {
  const contents = await readFile(path, 'utf-8')
  await writeFile(path, await update(contents), 'utf-8')
}

async function updateConfigFile (path, update) {
  const contents = JSON.parse(await readFile(path, 'utf-8'))
  await update(contents)
  await writeFile(path, JSON.stringify(contents, null, 2), 'utf-8')
}

async function verifyResponse (baseUrl, service, expectedWorker, socket) {
  const res = await request(baseUrl + `/${service}/hello`)

  deepStrictEqual(res.statusCode, 200)
  deepStrictEqual(res.headers['x-plt-socket'], socket)
  deepStrictEqual(res.headers['x-plt-worker-id'], expectedWorker.toString())
  deepStrictEqual(await res.body.json(), { from: service })
}

async function verifyInject (client, service, expectedWorker) {
  const res = await client.request({ method: 'GET', path: `/api/v1/services/${service}/proxy/hello` })

  deepStrictEqual(res.statusCode, 200)
  deepStrictEqual(res.headers['x-plt-worker-id'], expectedWorker.toString())
  deepStrictEqual(await res.body.json(), { from: service })
}

async function openLogsWebsocket (app) {
  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const managementApiWebsocket = new WebSocket(protocol + app.getManagementApiUrl() + ':/api/v1/logs/live')

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 3000)

    managementApiWebsocket.on('error', reject)

    managementApiWebsocket.on('open', () => {
      clearTimeout(timeout)
      resolve()
    })
  })

  return managementApiWebsocket
}

async function waitForLogs (socket, ...exprs) {
  const toMatch = new Set(exprs)
  const messages = []

  for await (const [msg] of on(socket, 'message')) {
    for (const line of msg.toString().trim().split('\n')) {
      const message = JSON.parse(line)
      messages.push(message)

      for (const expr of toMatch) {
        const matches = typeof expr === 'string' ? message.msg.startsWith(expr) : message.msg.match(expr)

        if (matches) {
          toMatch.delete(expr)

          if (toMatch.size === 0) {
            return messages
          }
        }
      }
    }
  }
}

test('services are started with multiple workers according to the configuration', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    await safeRemove(root)
    managementApiWebsocket.terminate()
  })

  await app.start()

  const startMessages = (
    await waitForLogs(
      managementApiWebsocket,
      'Starting service "composer"...',
      'Starting worker 0 of service "service"...',
      'Starting worker 1 of service "service"...',
      'Starting worker 2 of service "service"...',
      'Starting worker 0 of service "node"...',
      'Starting worker 1 of service "node"...',
      'Starting worker 2 of service "node"...',
      'Starting worker 3 of service "node"...',
      'Starting worker 4 of service "node"...',
      'Platformatic is now listening'
    )
  ).map(m => m.msg)

  ok(!startMessages.includes('Starting worker 0 of service "composer"...'))
  ok(!startMessages.includes('Starting worker 3 of service "service"...'))
  ok(!startMessages.includes('Starting worker 4 of service "service"...'))

  const stopMessagesPromise = waitForLogs(
    managementApiWebsocket,
    'Stopping service "composer"...',
    'Stopping worker 0 of service "service"...',
    'Stopping worker 1 of service "service"...',
    'Stopping worker 2 of service "service"...',
    'Stopping worker 0 of service "node"...',
    'Stopping worker 1 of service "node"...',
    'Stopping worker 2 of service "node"...',
    'Stopping worker 3 of service "node"...',
    'Stopping worker 4 of service "node"...'
  )

  await app.stop()
  const stopMessages = (await stopMessagesPromise).map(m => m.msg)

  ok(!stopMessages.includes('Stopping worker 0 of service "composer"...'))
})

test('services are started with a single workers in development', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    await safeRemove(root)
    managementApiWebsocket.terminate()
  })

  const messagesPromise = waitForLogs(
    managementApiWebsocket,
    'Starting service "service"...',
    'Starting service "node"...',
    'Starting service "composer"...',
    'Stopping service "service"...',
    'Stopping service "node"...',
    'Stopping service "composer"...'
  )

  await app.start()
  await app.stop()
  const messages = (await messagesPromise).map(m => m.msg)

  ok(!messages.includes('Starting worker 0 of service "service"...'))
  ok(!messages.includes('Starting worker 0 of service "node"...'))
  ok(!messages.includes('Starting worker 0 of service "composer"...'))
})

test('the mesh network works with the internal dispatcher', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
    await safeRemove(root)
  })

  await verifyResponse(entryUrl, 'service', 0, 'MockSocket')
  await verifyResponse(entryUrl, 'node', 0, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 1, 'MockSocket')
  await verifyResponse(entryUrl, 'node', 1, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 2, 'MockSocket')
  await verifyResponse(entryUrl, 'node', 2, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 0, 'MockSocket')
  await verifyResponse(entryUrl, 'node', 3, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 1, 'MockSocket')
  await verifyResponse(entryUrl, 'node', 4, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 2, 'MockSocket')
  await verifyResponse(entryUrl, 'node', 0, 'MockSocket')
})

test('the mesh network works with the HTTP services', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')

  await updateConfigFile(configFile, contents => {
    contents.services[0].useHttp = true
    contents.services.push({
      id: 'service',
      path: './service',
      config: 'platformatic.json',
      useHttp: true,
      workers: 3
    })
  })

  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
    await safeRemove(root)
  })

  await verifyResponse(entryUrl, 'service', 0, 'Socket')
  await verifyResponse(entryUrl, 'node', 0, 'Socket')

  await verifyResponse(entryUrl, 'service', 1, 'Socket')
  await verifyResponse(entryUrl, 'node', 1, 'Socket')

  await verifyResponse(entryUrl, 'service', 2, 'Socket')
  await verifyResponse(entryUrl, 'node', 2, 'Socket')

  await verifyResponse(entryUrl, 'service', 0, 'Socket')
  await verifyResponse(entryUrl, 'node', 3, 'Socket')

  await verifyResponse(entryUrl, 'service', 1, 'Socket')
  await verifyResponse(entryUrl, 'node', 4, 'Socket')

  await verifyResponse(entryUrl, 'service', 2, 'Socket')
  await verifyResponse(entryUrl, 'node', 0, 'Socket')
})

// Note: this cannot be tested in production mode as watching is always disabled
test('can detect changes and restart all workers for a service', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
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
    await safeRemove(root)
    managementApiWebsocket.terminate()
  })

  await app.start()

  await waitForLogs(
    managementApiWebsocket,
    'Starting service "node"...',
    'start watching files',
    'Platformatic is now listening'
  )

  await updateFile(resolve(root, 'node/index.mjs'), contents => {
    return contents.replace("{ from: 'node' }", "{ from: 'node-after-reload' }")
  })

  await waitForLogs(
    managementApiWebsocket,
    'files changed',
    'Stopping service "node"...',
    'Starting service "node"...',
    'Service node has been successfully reloaded ...'
  )
})

test('can restart only crashed workers when they throw an exception during start', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    await safeRemove(root)
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
    'Stopping worker 0 of service "node"...',
    'Failed to start worker 0 of service "node" after 5 attempts.'
  )

  await client.request({ method: 'POST', path: '/api/v1/services/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/services/node/start' })
  await client.close()

  const messages = await waitPromise

  deepStrictEqual(
    messages.filter(m => m.msg === 'Failed to start worker 0 of service "node".' && m.err?.message === 'kaboom').length,
    6
  )

  for (let i = 1; i <= 5; i++) {
    ok(
      messages.find(
        m => m.msg === `Attempt ${i} of 5 to start worker 0 of service "node" again will be performed in 500ms ...`
      )
    )
  }

  managementApiWebsocket.terminate()
})

test('can restart only crashed workers when they exit during start', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    await safeRemove(root)
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
    'Stopping worker 0 of service "node"...',
    'Failed to start worker 0 of service "node" after 5 attempts.'
  )

  await client.request({ method: 'POST', path: '/api/v1/services/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/services/node/start' })
  client.close()

  const messages = await waitPromise

  deepStrictEqual(
    messages.filter(
      m =>
        m.msg === 'Failed to start worker 0 of service "node".' &&
        m.err?.message === 'The service node:0 exited prematurely with error code 1'
    ).length,
    6
  )

  for (let i = 1; i <= 5; i++) {
    ok(
      messages.find(
        m => m.msg === `Attempt ${i} of 5 to start worker 0 of service "node" again will be performed in 500ms ...`
      )
    )
  }

  managementApiWebsocket.terminate()
})

test('can restart only crashed workers when they crash', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    await safeRemove(root)
    managementApiWebsocket.terminate()
  })

  await app.start()

  await updateFile(resolve(root, 'node/index.mjs'), contents => {
    return (
      contents +
      "\n\nif(globalThis.platformatic.worker % 2 === 0) { setTimeout(() => { throw new Error('kaboom') }, 250) }"
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
    'Worker 0 of service "node" threw an uncaught exception.',
    'Worker 2 of service "node" threw an uncaught exception.',
    'Worker 4 of service "node" threw an uncaught exception.',
    'Worker 0 of service "node" unexpectedly exited with code 1.',
    'Worker 2 of service "node" unexpectedly exited with code 1.',
    'Worker 4 of service "node" unexpectedly exited with code 1.',
    'Worker 0 of service "node" will be restarted in 500ms..',
    'Worker 2 of service "node" will be restarted in 500ms..',
    'Worker 4 of service "node" will be restarted in 500ms..'
  )

  await client.request({ method: 'POST', path: '/api/v1/services/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/services/node/start' })
  client.close()

  const messages = await waitPromise

  ok(
    messages.find(
      m => m.msg === 'Worker 0 of service "node" threw an uncaught exception.' && m.err?.message === 'kaboom'
    )
  )
  ok(
    messages.find(
      m => m.msg === 'Worker 2 of service "node" threw an uncaught exception.' && m.err?.message === 'kaboom'
    )
  )
  ok(
    messages.find(
      m => m.msg === 'Worker 4 of service "node" threw an uncaught exception.' && m.err?.message === 'kaboom'
    )
  )

  ok(!messages.find(m => m.msg === 'Worker 1 of service "node" threw an uncaught exception.'))
  ok(!messages.find(m => m.msg === 'Worker 3 of service "node" threw an uncaught exception.'))
  ok(!messages.find(m => m.msg === 'Worker 1 of service "node" will be restarted in 500ms...'))
  ok(!messages.find(m => m.msg === 'Worker 3 of service "node" will be restarted in 500ms..'))

  managementApiWebsocket.terminate()
})

test('can restart only crashed workers when they exit', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    await safeRemove(root)
    managementApiWebsocket.terminate()
  })

  await app.start()

  await updateFile(resolve(root, 'node/index.mjs'), contents => {
    return contents + '\n\nif(globalThis.platformatic.worker % 2 === 0) { setTimeout(() => { process.exit(1) }, 250) }'
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
    'Worker 0 of service "node" unexpectedly exited with code 1.',
    'Worker 2 of service "node" unexpectedly exited with code 1.',
    'Worker 4 of service "node" unexpectedly exited with code 1.',
    'Worker 0 of service "node" will be restarted in 500ms...',
    'Worker 2 of service "node" will be restarted in 500ms...',
    'Worker 4 of service "node" will be restarted in 500ms...'
  )

  await client.request({ method: 'POST', path: '/api/v1/services/node/stop' })
  await client.request({ method: 'POST', path: '/api/v1/services/node/start' })
  client.close()

  const messages = await waitPromise

  ok(!messages.find(m => m.msg === 'Worker 1 of service "node" unexpectedly exited with code 1.'))
  ok(!messages.find(m => m.msg === 'Worker 3 of service "node" unexpectedly exited with code 1.'))
  ok(!messages.find(m => m.msg === 'Worker 1 of service "node" will be restarted in 500ms...'))
  ok(!messages.find(m => m.msg === 'Worker 3 of service "node" will be restarted in 500ms..'))

  managementApiWebsocket.terminate()
})

test('can inject on a worker', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)
  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    await safeRemove(root)
    managementApiWebsocket.terminate()
  })

  await app.start()

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

  let nextWorker

  {
    const res = await client.request({ method: 'GET', path: '/api/v1/services/node/proxy/hello' })
    nextWorker = parseInt(res.headers['x-plt-worker-id']) + 1
  }

  await verifyInject(client, 'node', nextWorker)
  await verifyInject(client, 'node', (nextWorker + 1) % 5)
  await verifyInject(client, 'node', (nextWorker + 2) % 5)
  await verifyInject(client, 'node', (nextWorker + 3) % 5)
  await verifyInject(client, 'node', (nextWorker + 4) % 5)
  await verifyInject(client, 'node', nextWorker)
  await client.close()
})

test.only('can collect metrics with worker label', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)

  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
    await safeRemove(root)
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

  // TODO@ShogunPanda: Currently the runtime only ask metrics to a single worker. It must ask all of them
  ok(
    servicesMetrics.every(s => {
      const firstValue = s.values[0]
      const serviceId = firstValue?.labels?.['serviceId']
      const workerId = firstValue?.labels?.['workerId']

      switch (serviceId) {
        case 'composer':
          return workerId === 0
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
})
