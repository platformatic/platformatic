'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')

const pltVersion = require('../package.json').version

// Each test runtime app adds own process listeners
process.setMaxListeners(100)

test('should stop all services with a dashboard api', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-dashboard.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.dashboard.close()
  })

  const { address, port } = app.dashboard.server.address()
  const dashboardOrigin = `http://${address}:${port}`

  const { statusCode } = await request(dashboardOrigin, {
    method: 'POST',
    path: '/api/services/stop'
  })

  assert.strictEqual(statusCode, 200)

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }

  {
    const serviceDetails = await app.getServiceDetails('serviceApp')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }
})

test('should start all services with a dashboard api', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-dashboard.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  t.after(async () => {
    await app.close()
    await app.dashboard.close()
  })

  const { address, port } = app.dashboard.server.address()
  const dashboardOrigin = `http://${address}:${port}`

  const { statusCode } = await request(dashboardOrigin, {
    method: 'POST',
    path: '/api/services/start'
  })

  assert.strictEqual(statusCode, 200)

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'started')
  }

  {
    const serviceDetails = await app.getServiceDetails('serviceApp')
    assert.strictEqual(serviceDetails.status, 'started')
  }
})

test('should restart all services with a dashboard api', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-dashboard.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.dashboard.close()
  })

  const { address, port } = app.dashboard.server.address()
  const dashboardOrigin = `http://${address}:${port}`

  const { statusCode } = await request(dashboardOrigin, {
    method: 'POST',
    path: '/api/services/restart'
  })

  assert.strictEqual(statusCode, 200)

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'started')
  }

  {
    const serviceDetails = await app.getServiceDetails('serviceApp')
    assert.strictEqual(serviceDetails.status, 'started')
  }
})

test('should get service details', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-dashboard.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.dashboard.close()
  })

  const { address, port } = app.dashboard.server.address()
  const dashboardOrigin = `http://${address}:${port}`

  const { statusCode, body } = await request(dashboardOrigin, {
    method: 'GET',
    path: '/api/services/with-logger'
  })

  assert.strictEqual(statusCode, 200)

  const serviceDetails = await body.json()
  assert.deepStrictEqual(serviceDetails, {
    id: 'with-logger',
    status: 'started',
    entrypoint: false,
    localUrl: 'http://with-logger.plt.local',
    dependencies: []
  })
})

test('should get service config', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-dashboard.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.dashboard.close()
  })

  const { address, port } = app.dashboard.server.address()
  const dashboardOrigin = `http://${address}:${port}`

  const { statusCode, body } = await request(dashboardOrigin, {
    method: 'GET',
    path: '/api/services/with-logger/config'
  })

  assert.strictEqual(statusCode, 200)

  const serviceConfig = await body.json()
  assert.deepStrictEqual(serviceConfig, {
    $schema: `https://platformatic.dev/schemas/v${pltVersion}/service`,
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        transport: {
          target: 'pino-pretty'
        }
      },
      keepAliveTimeout: 5000
    },
    service: { openapi: true },
    plugins: {
      paths: [
        join(fixturesDir, 'monorepo', 'serviceAppWithLogger', 'plugin.js')
      ]
    },
    watch: {
      enabled: false
    }
  })
})

test('should get services topology', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-dashboard.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.dashboard.close()
  })

  const { address, port } = app.dashboard.server.address()
  const dashboardOrigin = `http://${address}:${port}`

  const { statusCode, body } = await request(dashboardOrigin, {
    method: 'GET',
    path: '/api/services'
  })

  assert.strictEqual(statusCode, 200)

  const topology = await body.json()

  assert.deepStrictEqual(topology, {
    entrypoint: 'serviceApp',
    services: [
      {
        dependencies: [],
        entrypoint: false,
        id: 'dbApp',
        localUrl: 'http://dbApp.plt.local',
        status: 'started'
      },
      {
        id: 'serviceApp',
        status: 'started',
        entrypoint: true,
        localUrl: 'http://serviceApp.plt.local',
        dependencies: [
          {
            id: 'with-logger',
            url: 'http://with-logger.plt.local',
            local: true
          }
        ]
      },
      {
        id: 'with-logger',
        status: 'started',
        entrypoint: false,
        localUrl: 'http://with-logger.plt.local',
        dependencies: []
      },
      {
        id: 'multi-plugin-service',
        status: 'started',
        entrypoint: false,
        localUrl: 'http://multi-plugin-service.plt.local',
        dependencies: []
      }
    ]
  })
})

test('should stop service by service id', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-dashboard.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.dashboard.close()
  })

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'started')
  }

  const { address, port } = app.dashboard.server.address()
  const dashboardOrigin = `http://${address}:${port}`

  const { statusCode } = await request(dashboardOrigin, {
    method: 'POST',
    path: '/api/services/with-logger/stop'
  })

  assert.strictEqual(statusCode, 200)

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }
})

test('should start stopped service by service id', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-dashboard.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.dashboard.close()
  })

  await app.stopService('with-logger')

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }

  const { address, port } = app.dashboard.server.address()
  const dashboardOrigin = `http://${address}:${port}`

  const { statusCode } = await request(dashboardOrigin, {
    method: 'POST',
    path: '/api/services/with-logger/start'
  })

  assert.strictEqual(statusCode, 200)

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'started')
  }
})

test('should start dashboard with default options', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-dashboard.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)

  config.configManager.current.dashboard = true
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.dashboard.close()
  })

  await app.stopService('with-logger')

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }

  const { address, port } = app.dashboard.server.address()

  assert.strictEqual(address, '127.0.0.1')
  assert.strictEqual(port, 4042)
})
