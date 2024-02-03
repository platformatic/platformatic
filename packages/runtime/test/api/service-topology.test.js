'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

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
        id: 'db-app',
        status: 'started',
        entrypoint: false,
        localUrl: 'http://db-app.plt.local',
        dependencies: []
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
