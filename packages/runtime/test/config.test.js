'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { loadConfig } = require('@platformatic/service')
const { parseInspectorOptions, platformaticRuntime } = require('../lib/config')
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

test('parseInspectorOptions()', async (t) => {
  await t.test('throws if --inspect and --inspect-brk are both used', () => {
    assert.throws(() => {
      const cm = {
        args: { inspect: '', 'inspect-brk': '' },
        current: {}
      }

      parseInspectorOptions(cm)
    }, /--inspect and --inspect-brk cannot be used together/)
  })

  await t.test('--inspect default settings', () => {
    const cm = {
      args: { inspect: '' },
      current: {}
    }

    parseInspectorOptions(cm)
    assert.deepStrictEqual(cm.current.inspectorOptions, {
      host: '127.0.0.1',
      port: 9229,
      breakFirstLine: false,
      hotReloadDisabled: false
    })
  })

  await t.test('--inspect-brk default settings', () => {
    const cm = {
      args: { 'inspect-brk': '' },
      current: {}
    }

    parseInspectorOptions(cm)
    assert.deepStrictEqual(cm.current.inspectorOptions, {
      host: '127.0.0.1',
      port: 9229,
      breakFirstLine: true,
      hotReloadDisabled: false
    })
  })

  await t.test('hot reloading is disabled if the inspector is used', () => {
    const cm1 = {
      args: { 'inspect-brk': '' },
      current: { hotReload: true }
    }

    parseInspectorOptions(cm1)
    assert.strictEqual(cm1.current.hotReload, false)

    const cm2 = {
      args: {},
      current: { hotReload: true }
    }

    parseInspectorOptions(cm2)
    assert.strictEqual(cm2.current.hotReload, true)
  })

  await t.test('sets port to a custom value', () => {
    const cm = {
      args: { inspect: '6666' },
      current: {}
    }

    parseInspectorOptions(cm)
    assert.deepStrictEqual(cm.current.inspectorOptions, {
      host: '127.0.0.1',
      port: 6666,
      breakFirstLine: false,
      hotReloadDisabled: false
    })
  })

  await t.test('sets host and port to custom values', () => {
    const cm = {
      args: { inspect: '0.0.0.0:6666' },
      current: {}
    }

    parseInspectorOptions(cm)
    assert.deepStrictEqual(cm.current.inspectorOptions, {
      host: '0.0.0.0',
      port: 6666,
      breakFirstLine: false,
      hotReloadDisabled: false
    })
  })

  await t.test('throws if the host is empty', () => {
    assert.throws(() => {
      const cm = {
        args: { inspect: ':9229' },
        current: {}
      }

      parseInspectorOptions(cm)
    }, /inspector host cannot be empty/)
  })

  await t.test('differentiates valid and invalid ports', () => {
    ['127.0.0.1:', 'foo', '1', '-1', '1023', '65536'].forEach((inspectFlag) => {
      assert.throws(() => {
        const cm = {
          args: { inspect: inspectFlag },
          current: {}
        }

        parseInspectorOptions(cm)
      }, /inspector port must be 0 or in range 1024 to 65535/)
    })

    const cm = {
      args: {},
      current: {}
    }

    cm.args.inspect = '0'
    parseInspectorOptions(cm)
    assert.strictEqual(cm.current.inspectorOptions.port, 0)
    cm.args.inspect = '1024'
    parseInspectorOptions(cm)
    assert.strictEqual(cm.current.inspectorOptions.port, 1024)
    cm.args.inspect = '1025'
    parseInspectorOptions(cm)
    assert.strictEqual(cm.current.inspectorOptions.port, 1025)
    cm.args.inspect = '65534'
    parseInspectorOptions(cm)
    assert.strictEqual(cm.current.inspectorOptions.port, 65534)
    cm.args.inspect = '65535'
    parseInspectorOptions(cm)
    assert.strictEqual(cm.current.inspectorOptions.port, 65535)
  })
})
