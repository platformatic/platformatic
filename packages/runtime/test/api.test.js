'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')

// Each test runtime app adds own process listeners
process.setMaxListeners(100)

test('should get service details', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const serviceDetails = await app.getServiceDetails('with-logger')
  assert.deepStrictEqual(serviceDetails, {
    id: 'with-logger',
    status: 'started',
    entrypoint: false,
    localUrl: 'http://with-logger.plt.local',
    dependencies: []
  })
})

test('should get service config', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const serviceConfig = await app.getServiceConfig('with-logger')

  delete serviceConfig.$schema

  // TODO: should return correct logger config
  assert.deepStrictEqual(serviceConfig, {
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
      ]
    },
    watch: {
      enabled: false
    }
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

  const topology = await app.getServices()

  assert.deepStrictEqual(topology, {
    entrypoint: 'serviceApp',
    services: [
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
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'started')
  }

  await app.stopService('with-logger')

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'stopped')
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
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }

  await app.startService('with-logger')

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'started')
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
    assert.strictEqual(err.message, 'Application is already started')
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

test('does not wait forever if worker exits during api operation', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'service-throws-on-start.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await assert.rejects(async () => {
    await app.start()
  }, /The runtime exited before the operation completed/)
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
    promises.push(app.getServiceDetails('with-logger'))
  }

  await Promise.all(promises)
})

test('should get a service openapi schema', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const openapiSchema = await app.getServiceOpenapiSchema('with-logger')
  assert.deepStrictEqual(openapiSchema, {
    openapi: '3.0.3',
    info: {
      title: 'Platformatic',
      description: 'This is a service built on top of Platformatic',
      version: '1.0.0'
    },
    components: { schemas: {} },
    paths: {
      '/': {
        get: {
          responses: {
            200: {
              description: 'Default Response'
            }
          }
        }
      }
    }
  })
})

test('should fail to get a service openapi schema if service does not expose it', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-openapi.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const openapiSchema = await app.getServiceOpenapiSchema('without-openapi')
  assert.strictEqual(openapiSchema, null)
})
