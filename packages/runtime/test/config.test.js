'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const pino = require('pino')
const { loadConfig } = require('@platformatic/config')
const { platformaticService } = require('@platformatic/service')
const { platformaticDB } = require('@platformatic/db')
const RuntimeApi = require('../lib/api')
const { parseInspectorOptions, platformaticRuntime } = require('../lib/config')
const { wrapConfigInRuntimeConfig } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')
const { Store } = require('@platformatic/config')

test('throws if no entrypoint is found', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'invalid-entrypoint.json')

  platformaticRuntime() // Coverage cheat.

  await assert.rejects(async () => {
    await loadConfig({}, ['-c', configFile], platformaticRuntime)
  }, /Invalid entrypoint: 'invalid' does not exist/)
})

test('throws if a config file is not found for an individual service', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'missing-service-config.json')

  await assert.rejects(async () => {
    await loadConfig({}, ['-c', configFile], platformaticRuntime)
  }, /No config file found for service 'docs'/)
})

test('throws if both autoload and services are provided', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'invalid-autoload-with-services.json')

  await assert.rejects(async () => {
    await loadConfig({}, ['-c', configFile], platformaticRuntime)
  }, /Autoload cannot be used when services is defined/)
})

test('dependencies are not considered if services are specified manually', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer-no-autoload.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)

  const runtime = new RuntimeApi(config.configManager.current, pino(), undefined)
  const services = await runtime._resolveBootstrapDependencies()

  assert.deepStrictEqual(Array.from(services.keys()), [
    'with-logger',
    'db-app',
    'composerApp',
    'multi-plugin-service',
    'serviceApp',
  ])
})

test('dependencies are resolved if services are not specified manually', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)

  const runtime = new RuntimeApi(config.configManager.current, pino(), undefined)
  const services = await runtime._resolveBootstrapDependencies()

  assert.deepStrictEqual(Array.from(services.keys()), [
    'dbApp',
    'serviceApp',
    'with-logger',
    'multi-plugin-service',
    'composerApp',
  ])
})

test('parseInspectorOptions()', async (t) => {
  await t.test('throws if --inspect and --inspect-brk are both used', () => {
    assert.throws(() => {
      const cm = {
        args: { inspect: '', 'inspect-brk': '' },
        current: {},
      }

      parseInspectorOptions(cm)
    }, /--inspect and --inspect-brk cannot be used together/)
  })

  await t.test('--inspect default settings', () => {
    const cm = {
      args: { inspect: '' },
      current: {},
    }

    parseInspectorOptions(cm)
    assert.deepStrictEqual(cm.current.inspectorOptions, {
      host: '127.0.0.1',
      port: 9229,
      breakFirstLine: false,
      hotReloadDisabled: false,
    })
  })

  await t.test('--inspect-brk default settings', () => {
    const cm = {
      args: { 'inspect-brk': '' },
      current: {},
    }

    parseInspectorOptions(cm)
    assert.deepStrictEqual(cm.current.inspectorOptions, {
      host: '127.0.0.1',
      port: 9229,
      breakFirstLine: true,
      hotReloadDisabled: false,
    })
  })

  await t.test('hot reloading is disabled if the inspector is used', () => {
    const cm1 = {
      args: { 'inspect-brk': '' },
      current: { hotReload: true },
    }

    parseInspectorOptions(cm1)
    assert.strictEqual(cm1.current.hotReload, false)

    const cm2 = {
      args: {},
      current: { hotReload: true },
    }

    parseInspectorOptions(cm2)
    assert.strictEqual(cm2.current.hotReload, true)
  })

  await t.test('sets port to a custom value', () => {
    const cm = {
      args: { inspect: '6666' },
      current: {},
    }

    parseInspectorOptions(cm)
    assert.deepStrictEqual(cm.current.inspectorOptions, {
      host: '127.0.0.1',
      port: 6666,
      breakFirstLine: false,
      hotReloadDisabled: false,
    })
  })

  await t.test('sets host and port to custom values', () => {
    const cm = {
      args: { inspect: '0.0.0.0:6666' },
      current: {},
    }

    parseInspectorOptions(cm)
    assert.deepStrictEqual(cm.current.inspectorOptions, {
      host: '0.0.0.0',
      port: 6666,
      breakFirstLine: false,
      hotReloadDisabled: false,
    })
  })

  await t.test('throws if the host is empty', () => {
    assert.throws(() => {
      const cm = {
        args: { inspect: ':9229' },
        current: {},
      }

      parseInspectorOptions(cm)
    }, /Inspector host cannot be empty/)
  })

  await t.test('differentiates valid and invalid ports', () => {
    ['127.0.0.1:', 'foo', '1', '-1', '1023', '65536'].forEach((inspectFlag) => {
      assert.throws(() => {
        const cm = {
          args: { inspect: inspectFlag },
          current: {},
        }

        parseInspectorOptions(cm)
      }, /Inspector port must be 0 or in range 1024 to 65535/)
    })

    const cm = {
      args: {},
      current: {},
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

test('same schemaOptions as platformatic service', async () => {
  assert.deepStrictEqual(platformaticRuntime.schemaOptions, platformaticService.schemaOptions)
})

test('correctly loads the hotReload value from a string', async () => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-hotreload-env.json')
  process.env.PLT_HOT_RELOAD = 'true'
  const loaded = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  assert.strictEqual(loaded.configManager.current.hotReload, true)
})

test('correctly loads the hotReload value from a string', async () => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-hotreload-env.json')
  process.env.PLT_HOT_RELOAD = 'false'
  const loaded = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  assert.strictEqual(loaded.configManager.current.hotReload, false)
})

test('defaults the service name to `main` if there is no package.json', async (t) => {
  const configFile = join(fixturesDir, 'dbAppNoPackageJson', 'platformatic.db.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticDB)
  const runtimeConfig = await wrapConfigInRuntimeConfig(config)
  const conf = runtimeConfig.current
  assert.strictEqual(conf.services.length, 1)
  assert.strictEqual(conf.services[0].id, 'main')
})

test('uses the name in package.json', async (t) => {
  const configFile = join(fixturesDir, 'dbAppWithMigrationError', 'platformatic.db.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticDB)
  const runtimeConfig = await wrapConfigInRuntimeConfig(config)
  const conf = runtimeConfig.current
  assert.strictEqual(conf.services.length, 1)
  assert.strictEqual(conf.services[0].id, 'mysimplename')
})

test('uses the name in package.json, removing the scope', async (t) => {
  const configFile = join(fixturesDir, 'dbApp', 'platformatic.db.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticDB)
  const runtimeConfig = await wrapConfigInRuntimeConfig(config)
  const conf = runtimeConfig.current
  assert.strictEqual(conf.services.length, 1)
  assert.strictEqual(conf.services[0].id, 'myname')
})

test('defaults name to `main` if package.json exists but has no name', async (t) => {
  const configFile = join(fixturesDir, 'dbAppNoName', 'platformatic.db.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticDB)
  const runtimeConfig = await wrapConfigInRuntimeConfig(config)
  const conf = runtimeConfig.current
  assert.strictEqual(conf.services.length, 1)
  assert.strictEqual(conf.services[0].id, 'main')
})

test('loads with the store', async (t) => {
  const cwd = process.cwd()
  process.chdir(join(fixturesDir, 'configs'))
  t.after(() => {
    process.chdir(cwd)
  })
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')

  const store = new Store()
  store.add(platformaticRuntime)

  const { configManager } = await store.loadConfig({
    config: configFile,
    overrides: {
      fixPaths: false,
      onMissingEnv (key) {
        return '{' + key + '}'
      },
    },
  })

  await configManager.parseAndValidate(false)
})
