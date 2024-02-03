'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

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
