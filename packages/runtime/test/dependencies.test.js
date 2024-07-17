'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const pino = require('pino')
const { loadConfig } = require('@platformatic/config')
const { platformaticRuntime } = require('..')
const RuntimeApi = require('../lib/api')

const fixturesDir = join(__dirname, '..', 'fixtures')

test('parses composer and client dependencies', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-dependencies.json')
  const loaded = await loadConfig({}, ['-c', configFile], platformaticRuntime)

  const runtime = new RuntimeApi(loaded.configManager.current, pino(), undefined)
  await runtime._resolveBootstrapDependencies()
  const services = loaded.configManager.current.services

  const mainService = services.find((service) => service.id === 'main')

  assert.deepStrictEqual(mainService.dependencies, [
    { id: 'service-1', url: 'http://service-1.plt.local', local: true },
    {
      id: 'external-service-1',
      url: 'http://external-dependency-1',
      local: false
    }
  ])

  const service1 = services.find((service) => service.id === 'service-1')
  assert.deepStrictEqual(service1.dependencies, [])

  const service2 = services.find((service) => service.id === 'service-2')
  assert.deepStrictEqual(service2.dependencies, [])
})

test('correct throws on missing dependencies', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-missing-dependencies.json')
  const loaded = await loadConfig({}, ['-c', configFile], platformaticRuntime)

  const runtime = new RuntimeApi(loaded.configManager.current, pino(), undefined)

  await assert.rejects(
    () => runtime._resolveBootstrapDependencies(),
    { name: 'FastifyError', message: 'Missing dependency: "service \'composer\' has unknown dependency: \'missing\'."' }
  )
})
