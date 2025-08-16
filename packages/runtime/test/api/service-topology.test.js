'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

const platformaticVersion = require('../../package.json').version

test('should get services topology', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const entrypointDetails = await app.getEntrypointDetails()
  const topology = await app.getServices()

  assert.deepStrictEqual(topology, {
    entrypoint: 'serviceApp',
    production: false,
    services: [
      {
        id: 'db-app',
        type: 'db',
        status: 'started',
        version: platformaticVersion,
        entrypoint: false,
        localUrl: 'http://db-app.plt.local',
        dependencies: []
      },
      {
        id: 'serviceApp',
        type: 'service',
        status: 'started',
        version: platformaticVersion,
        entrypoint: true,
        url: entrypointDetails.url,
        localUrl: 'http://serviceApp.plt.local',
        dependencies: []
      },
      {
        id: 'with-logger',
        type: 'service',
        status: 'started',
        version: platformaticVersion,
        entrypoint: false,
        localUrl: 'http://with-logger.plt.local',
        dependencies: []
      },
      {
        id: 'multi-plugin-service',
        type: 'service',
        status: 'started',
        version: platformaticVersion,
        entrypoint: false,
        localUrl: 'http://multi-plugin-service.plt.local',
        dependencies: []
      }
    ]
  })
})

test('should get services topology (composer)', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const entrypointDetails = await app.getEntrypointDetails()
  const topology = await app.getServices()

  assert.deepStrictEqual(topology, {
    production: false,
    services: [
      {
        id: 'dbApp',
        type: 'db',
        status: 'started',
        version: platformaticVersion,
        localUrl: 'http://dbApp.plt.local',
        entrypoint: false,
        dependencies: []
      },
      {
        id: 'serviceApp',
        type: 'service',
        status: 'started',
        version: platformaticVersion,
        localUrl: 'http://serviceApp.plt.local',
        entrypoint: false,
        dependencies: []
      },
      {
        id: 'with-logger',
        type: 'service',
        status: 'started',
        version: platformaticVersion,
        localUrl: 'http://with-logger.plt.local',
        entrypoint: false,
        dependencies: []
      },
      {
        id: 'multi-plugin-service',
        type: 'service',
        status: 'started',
        version: platformaticVersion,
        localUrl: 'http://multi-plugin-service.plt.local',
        entrypoint: false,
        dependencies: []
      },
      {
        id: 'composerApp',
        type: 'composer',
        status: 'started',
        version: platformaticVersion,
        localUrl: 'http://composerApp.plt.local',
        entrypoint: true,
        dependencies: [
          {
            id: 'with-logger',
            url: 'http://with-logger.plt.local',
            local: true
          },
          {
            id: 'multi-plugin-service',
            url: 'http://multi-plugin-service.plt.local',
            local: true
          },
          {
            id: 'serviceApp',
            url: 'http://serviceApp.plt.local',
            local: true
          },
          {
            id: 'external-service',
            url: 'https://external-service.com',
            local: false
          }
        ],
        url: entrypointDetails.url
      }
    ],
    entrypoint: 'composerApp'
  })
})
