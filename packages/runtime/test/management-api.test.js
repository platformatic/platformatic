'use strict'

const assert = require('node:assert')
const { platform } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')
const WebSocket = require('ws')
const { isatty } = require('tty')

const { buildServer } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')

const platformaticVersion = require('../package.json').version

// Each test runtime app adds own process listeners
process.setMaxListeners(100)

test('should get the runtime metadata', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

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

  const entrypoint = await app.getEntrypointDetails()

  const metadata = await body.json()
  assert.deepStrictEqual(metadata, {
    pid: process.pid,
    cwd: process.cwd(),
    uptimeSeconds: Math.floor(process.uptime()),
    execPath: process.execPath,
    nodeVersion: process.version,
    packageName: 'test-runtime-package',
    packageVersion: '1.0.42',
    projectDir,
    url: entrypoint.url,
    status: 'started',
    platformaticVersion
  })
})

test('should stop all services with a management api', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

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
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }

  {
    const serviceDetails = await app.getServiceDetails('service-2')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }
})

test('should start all services with a management api', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

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
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'started')
  }

  {
    const serviceDetails = await app.getServiceDetails('service-2')
    assert.strictEqual(serviceDetails.status, 'started')
  }
})

test('should restart all services with a management api', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

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
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'started')
  }

  {
    const serviceDetails = await app.getServiceDetails('service-2')
    assert.strictEqual(serviceDetails.status, 'started')
  }
})

test('should get service details', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

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
    path: '/api/services/service-1'
  })

  assert.strictEqual(statusCode, 200)

  const entrypointDetails = await app.getEntrypointDetails()
  const serviceDetails = await body.json()
  assert.deepStrictEqual(serviceDetails, {
    id: 'service-1',
    status: 'started',
    entrypoint: true,
    url: entrypointDetails.url,
    localUrl: 'http://service-1.plt.local',
    dependencies: []
  })
})

test('should get service config', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

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
    path: '/api/services/service-1/config'
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
        join(projectDir, 'services', 'service-1', 'plugin.js')
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
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

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

  const entrypointDetails = await app.getEntrypointDetails()
  const topology = await body.json()

  assert.deepStrictEqual(topology, {
    entrypoint: 'service-1',
    services: [
      {
        id: 'service-1',
        status: 'started',
        entrypoint: true,
        url: entrypointDetails.url,
        localUrl: 'http://service-1.plt.local',
        dependencies: []
      },
      {
        id: 'service-2',
        status: 'started',
        entrypoint: false,
        localUrl: 'http://service-2.plt.local',
        dependencies: []
      }
    ]
  })
})

test('should stop service by service id', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  {
    const serviceDetails = await app.getServiceDetails('service-1')
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
    path: '/api/services/service-1/stop'
  })

  assert.strictEqual(statusCode, 200)

  {
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }
})

test('should start stopped service by service id', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  await app.stopService('service-1')

  {
    const serviceDetails = await app.getServiceDetails('service-1')
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
    path: '/api/services/service-1/start'
  })

  assert.strictEqual(statusCode, 200)

  {
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'started')
  }
})

test('should proxy request to the service', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

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
    path: '/api/services/service-2/proxy/hello'
  })

  assert.strictEqual(statusCode, 200)

  const data = await body.json()
  assert.deepStrictEqual(data, { service: 'service-2' })
})

test('should get service metrics via runtime management api proxy', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

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
    path: '/api/services/service-1/proxy/metrics'
  })

  assert.strictEqual(statusCode, 200)

  const data = await body.text()
  assert.ok(data)
})

test('should get runtime logs via management api', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  const socketPath = app.managementApi.server.address()

  let webSocket = null
  if (platform() === 'win32') {
    webSocket = new WebSocket('ws+pipe://' + socketPath + ':/api/logs')
  } else {
    webSocket = new WebSocket('ws+unix://' + socketPath + ':/api/logs')
  }

  return new Promise((resolve, reject) => {
    webSocket.on('error', (err) => {
      reject(err)
    })

    webSocket.on('message', (data) => {
      if (data.includes('Server listening at')) {
        resolve()
      } else {
        reject(new Error('Unexpected message: ' + data))
      }
    })
  })
})
