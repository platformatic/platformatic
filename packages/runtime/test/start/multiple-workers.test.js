'use strict'

const { cp, symlink, readFile, writeFile } = require('node:fs/promises')
const { ok, deepStrictEqual } = require('node:assert')
const { on } = require('node:events')
const { platform } = require('node:os')
const { join, resolve } = require('node:path')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
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

async function verifyResponse (baseUrl, service, expectedWorker, socket, additionalChecks) {
  const res = await request(baseUrl + `/${service}/hello`)
  const json = await res.body.json()

  deepStrictEqual(res.statusCode, 200)
  deepStrictEqual(res.headers['x-plt-socket'], socket)
  deepStrictEqual(res.headers['x-plt-worker-id'], expectedWorker.toString())
  deepStrictEqual(json, { from: service })
  additionalChecks?.(res, json)
}

async function verifyInject (client, service, expectedWorker, additionalChecks) {
  const res = await client.request({ method: 'GET', path: `/api/v1/services/${service}/proxy/hello` })
  const json = await res.body.json()

  deepStrictEqual(res.statusCode, 200)
  deepStrictEqual(res.headers['x-plt-worker-id'], expectedWorker.toString())
  deepStrictEqual(json, { from: service })
  additionalChecks?.(res, json)
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

  const waitPromise = waitForLogs(
    managementApiWebsocket,
    'Starting the service "composer"...',
    'Starting the worker 0 of the service "service"...',
    'Starting the worker 1 of the service "service"...',
    'Starting the worker 2 of the service "service"...',
    'Starting the worker 0 of the service "node"...',
    'Starting the worker 1 of the service "node"...',
    'Starting the worker 2 of the service "node"...',
    'Starting the worker 3 of the service "node"...',
    'Starting the worker 4 of the service "node"...',
    'Platformatic is now listening'
  )

  await app.start()

  const startMessages = (await waitPromise).map(m => m.msg)

  ok(!startMessages.includes('Starting the worker 0 of the service "composer"...'))
  ok(!startMessages.includes('Starting the worker 3 of the service "service"...'))
  ok(!startMessages.includes('Starting the worker 4 of the service "service"...'))

  const stopMessagesPromise = waitForLogs(
    managementApiWebsocket,
    'Stopping the service "composer"...',
    'Stopping the worker 0 of the service "service"...',
    'Stopping the worker 1 of the service "service"...',
    'Stopping the worker 2 of the service "service"...',
    'Stopping the worker 0 of the service "node"...',
    'Stopping the worker 1 of the service "node"...',
    'Stopping the worker 2 of the service "node"...',
    'Stopping the worker 3 of the service "node"...',
    'Stopping the worker 4 of the service "node"...'
  )

  await app.stop()
  const stopMessages = (await stopMessagesPromise).map(m => m.msg)

  ok(!stopMessages.includes('Stopping the worker 0 of the service "composer"...'))
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
  const ports = await Promise.all(
    [0, 1, 2].map(async worker => {
      const meta = await app.getServiceMeta(`service:${worker}`)
      return new URL(meta.composer.url).port
    })
  )

  t.after(async () => {
    await app.close()
    await safeRemove(root)
  })

  function verifySource (port, res) {
    deepStrictEqual(res.headers['x-plt-port'], port)
  }

  await verifyResponse(entryUrl, 'service', 0, 'Socket', verifySource.bind(null, ports[0]))
  await verifyResponse(entryUrl, 'node', 0, 'Socket')

  await verifyResponse(entryUrl, 'service', 1, 'Socket', verifySource.bind(null, ports[1]))
  await verifyResponse(entryUrl, 'node', 1, 'Socket')

  await verifyResponse(entryUrl, 'service', 2, 'Socket', verifySource.bind(null, ports[2]))
  await verifyResponse(entryUrl, 'node', 2, 'Socket')

  await verifyResponse(entryUrl, 'service', 0, 'Socket', verifySource.bind(null, ports[0]))
  await verifyResponse(entryUrl, 'node', 3, 'Socket')

  await verifyResponse(entryUrl, 'service', 1, 'Socket', verifySource.bind(null, ports[1]))
  await verifyResponse(entryUrl, 'node', 4, 'Socket')

  await verifyResponse(entryUrl, 'service', 2, 'Socket', verifySource.bind(null, ports[2]))
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

  const waitPromise1 = waitForLogs(
    managementApiWebsocket,
    'Starting the service "node"...',
    'start watching files',
    'Platformatic is now listening'
  )

  await app.start()
  await waitPromise1

  const waitPromise2 = waitForLogs(
    managementApiWebsocket,
    'files changed',
    'Stopping the service "node"...',
    'Starting the service "node"...',
    'Service "node" has been successfully reloaded ...'
  )

  await updateFile(resolve(root, 'node/index.mjs'), contents => {
    return contents.replace("{ from: 'node' }", "{ from: 'node-after-reload' }")
  })

  await waitPromise2
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

test('can collect metrics with worker label', async t => {
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

  const received = new Set()
  ok(
    servicesMetrics.every(s => {
      const firstValue = s.values[0]
      const serviceId = firstValue?.labels?.['serviceId']
      const workerId = firstValue?.labels?.['workerId']

      received.add(`${serviceId}:${workerId}`)
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

test('return workers information in the management API when starting in production mode', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
    await safeRemove(root)
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

  const res = await client.request({ method: 'GET', path: '/api/v1/services' })
  const json = await res.body.json()

  deepStrictEqual(json.services[0].id, 'node')
  deepStrictEqual(json.services[0].workers, 5)
  deepStrictEqual(json.services[1].id, 'service')
  deepStrictEqual(json.services[1].workers, 3)
  deepStrictEqual(json.services[2].id, 'composer')
  deepStrictEqual(json.services[2].workers, 1)
})

test('return no workers information in the management API when starting in development mode', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
    await safeRemove(root)
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

  const res = await client.request({ method: 'GET', path: '/api/v1/services' })
  const json = await res.body.json()

  deepStrictEqual(json.services[0].id, 'node')
  ok(!('workers' in json.services[1]))
  deepStrictEqual(json.services[1].id, 'service')
  ok(!('workers' in json.services[1]))
  deepStrictEqual(json.services[2].id, 'composer')
  ok(!('workers' in json.services[2]))
})

test('logging properly works in production mode when using separate processes', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)

  await updateConfigFile(resolve(root, 'node/platformatic.json'), contents => {
    contents.application = { commands: { production: 'node index.mjs' } }
  })

  await updateFile(resolve(root, 'node/index.mjs'), contents => {
    contents = contents.replace('function create', 'function main').replace('return app', 'app.listen({ port: 0 })')
    return contents + '\nmain()'
  })

  const app = await buildServer(config.configManager.current, config.args)

  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    await safeRemove(root)
    managementApiWebsocket.terminate()
  })

  const waitPromise = waitForLogs(
    managementApiWebsocket,
    'Starting the service "composer"...',
    'Starting the worker 0 of the service "service"...',
    'Starting the worker 1 of the service "service"...',
    'Starting the worker 2 of the service "service"...',
    'Starting the worker 0 of the service "node"...',
    'Starting the worker 1 of the service "node"...',
    'Starting the worker 2 of the service "node"...',
    'Starting the worker 3 of the service "node"...',
    'Starting the worker 4 of the service "node"...',
    'Platformatic is now listening',
    'Stopping the service "composer"...',
    'Stopping the worker 0 of the service "service"...',
    'Stopping the worker 1 of the service "service"...',
    'Stopping the worker 2 of the service "service"...',
    'Stopping the worker 0 of the service "node"...',
    'Stopping the worker 1 of the service "node"...',
    'Stopping the worker 2 of the service "node"...',
    'Stopping the worker 3 of the service "node"...',
    'Stopping the worker 4 of the service "node"...'
  )

  await app.start()
  // Wait for all logs to be delivered
  await sleep(3000)
  await app.stop()

  const messages = await waitPromise

  ok(messages.find(m => m.name === 'composer'))

  process._rawDebug(messages)
  for (let i = 0; i < 5; i++) {
    ok(messages.find(m => m.name === `node:${i}` && m.msg.startsWith('Server listening')))
  }
})

test('logging properly works in development mode using separate processes', async t => {
  const root = await prepareRuntime('multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)

  await updateConfigFile(resolve(root, 'node/platformatic.json'), contents => {
    contents.application = { commands: { production: 'node index.mjs' } }
  })

  await updateFile(resolve(root, 'node/index.mjs'), contents => {
    contents = contents.replace('function create', 'function main').replace('return app', 'app.listen({ port: 0 })')
    return contents + '\nmain()'
  })

  const app = await buildServer(config.configManager.current, config.args)

  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    await safeRemove(root)
    managementApiWebsocket.terminate()
  })

  const waitPromise = waitForLogs(
    managementApiWebsocket,
    'Starting the service "composer"...',
    'Starting the service "node"...',
    'Platformatic is now listening',
    'Stopping the service "composer"...',
    'Stopping the service "node"...'
  )

  await app.start()
  await app.stop()

  const messages = await waitPromise

  ok(messages.find(m => m.name === 'composer'))

  for (let i = 0; i < 5; i++) {
    ok(!messages.some(m => m.name === `node:${i}`))
  }
})
