'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/service')
const { buildServer, platformaticRuntime } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')

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
