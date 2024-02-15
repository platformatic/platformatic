'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')
const { isatty } = require('tty')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')

const platformaticVersion = require('../package.json').version

// Each test runtime app adds own process listeners
process.setMaxListeners(100)

test('should get the runtime metadata', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address()
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/metadata'
  })

  assert.strictEqual(statusCode, 200)

  const metadata = await body.json()
  assert.deepStrictEqual(metadata, {
    pid: process.pid,
    cwd: process.cwd(),
    execPath: process.execPath,
    nodeVersion: process.version,
    platformaticVersion
  })
})

test('should stop all services with a management api', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address()
  })

  const { statusCode } = await client.request({
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

test('should start all services with a management api', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address()
  })

  const { statusCode } = await client.request({
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

test('should restart all services with a management api', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address()
  })

  const { statusCode } = await client.request({
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
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address()
  })

  const { statusCode, body } = await client.request({
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
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address()
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/services/with-logger/config'
  })

  assert.strictEqual(statusCode, 200)

  const serviceConfig = await body.json()

  const logger = {}
  if (isatty(1) && !logger.transport) {
    logger.transport = {
      target: 'pino-pretty'
    }
  }

  assert.deepStrictEqual(serviceConfig, {
    $schema: `https://platformatic.dev/schemas/v${platformaticVersion}/service`,
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger,
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
    },
    metrics: {
      server: 'parent'
    }
  })
})

test('should get services topology', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address()
  })

  const { statusCode, body } = await client.request({
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
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'started')
  }

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address()
  })

  const { statusCode } = await client.request({
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
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  await app.stopService('with-logger')

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address()
  })

  const { statusCode } = await client.request({
    method: 'POST',
    path: '/api/services/with-logger/start'
  })

  assert.strictEqual(statusCode, 200)

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'started')
  }
})

test('should proxy request to the service', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address()
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/services/multi-plugin-service/proxy/plugin1'
  })

  assert.strictEqual(statusCode, 200)

  const data = await body.json()
  assert.deepStrictEqual(data, { hello: 'plugin1' })
})

test('should get service metrics via runtime management api proxy', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address()
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/services/with-logger/proxy/metrics'
  })

  assert.strictEqual(statusCode, 200)

  const data = await body.text()
  assert.ok(data)
})
