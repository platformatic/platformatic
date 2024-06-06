'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { loadConfig } = require('@platformatic/config')
const { platformaticRuntime } = require('..')

const fixturesDir = join(__dirname, '..', 'fixtures')

test('parses composer and client dependencies', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-dependencies.json')
  const loaded = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const services = loaded.configManager.current.services

  const mainService = services.find((service) => service.id === 'main')
  assert.deepStrictEqual(mainService.dependencies, [
    { id: 'service-1', url: 'http://service-1.plt.local', local: true },
    {
      id: 'external-service-1',
      url: 'http://external-dependency-1',
      local: false
    },
    { id: 'service-1', url: 'http://service-1.plt.local', local: true },
    { id: 'service-2', url: 'http://service-2.plt.local', local: true }
  ])
  assert.deepStrictEqual(
    Object.fromEntries(mainService.localServiceEnvVars.entries()),
    {
      PLT_SERVICE1_URL: 'http://service-1.plt.local',
      PLT_SERVICE2_URL: 'http://service-2.plt.local'
    }
  )

  const service1 = services.find((service) => service.id === 'service-1')
  assert.deepStrictEqual(service1.dependencies, [
    { id: 'service-2', url: 'http://service-2.plt.local', local: true },
    { id: undefined, url: 'http://external-dependency-1', local: false }
  ])
  assert.strictEqual(service1.localServiceEnvVars.size, 0)

  const service2 = services.find((service) => service.id === 'service-2')
  assert.deepStrictEqual(service2.dependencies, [])
  assert.strictEqual(service2.localServiceEnvVars.size, 0)
})
