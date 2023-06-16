'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/service')
const { buildServer, platformaticRuntime } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')

// Each test runtime app adds own process listeners
process.setMaxListeners(100)

test('should get service config', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const serviceConfig = await app.getServiceConfig('with-logger')

  // TODO: should return correct logger config
  assert.deepStrictEqual(serviceConfig, {
    $schema: 'https://platformatic.dev/schemas/v0.27.0/service',
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {},
      keepAliveTimeout: 5000
    },
    service: { openapi: true },
    plugins: {
      paths: [
        join(fixturesDir, 'monorepo', 'serviceAppWithLogger', 'plugin.js')
      ],
      hotReload: false
    },
    watch: false
  })
})

test('should fail to get service config if service is not started', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  t.after(async () => {
    await app.close()
  })

  try {
    await app.getServiceConfig('with-logger')
    assert.fail('should have thrown')
  } catch (err) {
    assert.strictEqual(err.message, 'Service with id \'with-logger\' is not started')
  }
})

test('should get services topology', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const topology = await app.getServicesTopology()

  assert.deepStrictEqual(topology, {
    entrypoint: 'serviceApp',
    services: [
      {
        id: 'serviceApp',
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
        dependencies: []
      },
      {
        id: 'multi-plugin-service',
        dependencies: []
      }
    ]
  })
})

test('should stop service by service id', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const serviceStatus = await app.getServiceStatus('with-logger')
    assert.strictEqual(serviceStatus, 'started')
  }

  await app.stopService('with-logger')

  {
    const serviceStatus = await app.getServiceStatus('with-logger')
    assert.strictEqual(serviceStatus, 'stopped')
  }
})

test('should fail to stop service with a wrong id', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  t.after(async () => {
    await app.close()
  })

  try {
    await app.stopService('wrong-service-id')
    assert.fail('should have thrown')
  } catch (err) {
    assert.strictEqual(err.message, 'Service with id \'wrong-service-id\' not found')
  }
})

test('should start stopped service by service id', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await app.stopService('with-logger')

  {
    const serviceStatus = await app.getServiceStatus('with-logger')
    assert.strictEqual(serviceStatus, 'stopped')
  }

  await app.startService('with-logger')

  {
    const serviceStatus = await app.getServiceStatus('with-logger')
    assert.strictEqual(serviceStatus, 'started')
  }
})

test('should fail to start service with a wrong id', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  t.after(async () => {
    await app.close()
  })

  try {
    await app.startService('wrong-service-id')
    assert.fail('should have thrown')
  } catch (err) {
    assert.strictEqual(err.message, 'Service with id \'wrong-service-id\' not found')
  }
})

test('should fail to start running service', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  try {
    await app.startService('with-logger')
    assert.fail('should have thrown')
  } catch (err) {
    assert.strictEqual(err.message, 'application is already started')
  }
})

test('should inject request to service', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const res = await app.inject('with-logger', {
    method: 'GET',
    url: '/'
  })

  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.statusMessage, 'OK')

  assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8')
  assert.strictEqual(res.headers['content-length'], '17')
  assert.strictEqual(res.headers.connection, 'keep-alive')

  assert.strictEqual(res.body, '{"hello":"world"}')
  assert.strictEqual(res.payload, '{"hello":"world"}')
})

test('should fail inject request is service is not started', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  t.after(async () => {
    await app.close()
  })

  try {
    await app.inject('with-logger', { method: 'GET', url: '/' })
  } catch (err) {
    assert.strictEqual(err.message, 'Service with id \'with-logger\' is not started')
  }
})

test('should handle a lot of runtime api requests', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const promises = []
  for (let i = 0; i < 100; i++) {
    promises.push(app.getServiceStatus('with-logger'))
  }

  await Promise.all(promises)
})
