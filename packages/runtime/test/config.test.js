'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { loadConfig } = require('@platformatic/service')
const { platformaticRuntime } = require('../lib/config')
const fixturesDir = join(__dirname, '..', 'fixtures')

test('throws if no entrypoint is found', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'invalid-entrypoint.json')

  platformaticRuntime() // Coverage cheat.

  await assert.rejects(async () => {
    await loadConfig({}, ['-c', configFile], platformaticRuntime)
  }, /invalid entrypoint: 'invalid' does not exist/)
})

test('throws if a config file is not found for an individual service', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'missing-service-config.json')

  await assert.rejects(async () => {
    await loadConfig({}, ['-c', configFile], platformaticRuntime)
  }, /no config file found for service 'docs'/)
})

test('performs a topological sort on services depending on allowCycles', async (t) => {
  await t.test('does not sort if allowCycles is true', async () => {
    const configFile = join(fixturesDir, 'configs', 'monorepo.json')
    const loaded = await loadConfig({}, ['-c', configFile], platformaticRuntime)
    const services = loaded.configManager.current.services

    assert.strictEqual(services.length, 3)
    assert.strictEqual(services[0].id, 'serviceApp')
    assert.strictEqual(services[1].id, 'with-logger')
    assert.strictEqual(services[2].id, 'multi-plugin-service')
  })

  await t.test('sorts if allowCycles is false', async () => {
    const configFile = join(fixturesDir, 'configs', 'monorepo-no-cycles.json')
    const loaded = await loadConfig({}, ['-c', configFile], platformaticRuntime)
    const services = loaded.configManager.current.services

    assert.strictEqual(services.length, 3)
    assert.strictEqual(services[0].id, 'with-logger')
    assert.strictEqual(services[1].id, 'serviceApp')
    assert.strictEqual(services[2].id, 'multi-plugin-service')
  })

  await t.test('throws if a cycle is present when not allowed', async () => {
    const configFile = join(fixturesDir, 'configs', 'monorepo-create-cycle.json')

    await assert.rejects(async () => {
      await loadConfig({}, ['-c', configFile], platformaticRuntime)
    })
  })
})

test('can resolve service id from client package.json if not provided', async () => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-client-without-id.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const entry = config.configManager.current.serviceMap.get('serviceApp')

  assert.strictEqual(entry.dependencies.length, 1)
  assert.strictEqual(entry.dependencies[0].id, 'with-logger')
})
