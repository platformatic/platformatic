'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { loadConfig } = require('@platformatic/config')
const { platformaticRuntime } = require('..')
const { Runtime } = require('../lib/runtime')
const { getRuntimeLogsDir } = require('../lib/utils')

const fixturesDir = join(__dirname, '..', 'fixtures')

test('parses composer and client dependencies', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-dependencies.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const dirname = config.configManager.dirname
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)

  const runtime = new Runtime(config.configManager, runtimeLogsDir, process.env)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  const { services } = await runtime.getServices()

  const mainService = services.find((service) => service.id === 'main')

  assert.deepStrictEqual(mainService.dependencies, [
    { id: 'service-1', url: 'http://service-1.plt.local', local: true },
    {
      id: 'external-service-1',
      url: 'http://external-dependency-1',
      local: false,
    },
  ])

  const service1 = services.find((service) => service.id === 'service-1')
  assert.deepStrictEqual(service1.dependencies, [])

  const service2 = services.find((service) => service.id === 'service-2')
  assert.deepStrictEqual(service2.dependencies, [])
})

test('correct throws on missing dependencies', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-missing-dependencies.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const dirname = config.configManager.dirname
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)

  const runtime = new Runtime(config.configManager, runtimeLogsDir, process.env)

  t.after(async () => {
    await runtime.close()
  })

  await assert.rejects(
    () => runtime.init(),
    { name: 'FastifyError', message: 'Missing dependency: "service \'composer\' has unknown dependency: \'missing\'."' }
  )
})
