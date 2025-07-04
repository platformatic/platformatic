'use strict'

const assert = require('node:assert')
const { join, resolve, dirname } = require('node:path')
const { test } = require('node:test')
const { loadConfig } = require('@platformatic/config')
const { platformaticService } = require('@platformatic/service')
const platformaticDatabase = require('@platformatic/db')
const { Runtime } = require('../lib/runtime')
const { parseInspectorOptions, platformaticRuntime } = require('../lib/config')
const { wrapConfigInRuntimeConfig } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')
const { Store } = require('@platformatic/config')
const { getRuntimeLogsDir } = require('../lib/utils')
const { setLogFile } = require('./helpers')

test.beforeEach(setLogFile)

test('throws if no entrypoint is found', async t => {
  const configFile = join(fixturesDir, 'configs', 'invalid-entrypoint.json')

  platformaticRuntime() // Coverage cheat.

  await assert.rejects(async () => {
    await loadConfig({}, ['-c', configFile], platformaticRuntime)
  }, /Invalid entrypoint: 'invalid' does not exist/)
})

test('throws if both web and services are provided', async t => {
  const configFile = join(fixturesDir, 'configs', 'invalid-web-with-services.json')

  await assert.rejects(async () => {
    await loadConfig({}, ['-c', configFile], platformaticRuntime)
  }, /The "services" property cannot be used when the "web" property is also defined/)
})

test('dependencies are not considered if services are specified manually', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer-no-autoload.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const dirname = config.configManager.dirname
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)

  const runtime = new Runtime(config.configManager, runtimeLogsDir, process.env)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  const { services } = await runtime.getServices()

  assert.deepStrictEqual(
    services.map(service => service.id),
    ['with-logger', 'db-app', 'composerApp', 'multi-plugin-service', 'serviceApp']
  )
})

test('dependencies are resolved if services are not specified manually', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const dirname = config.configManager.dirname
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)

  const runtime = new Runtime(config.configManager, runtimeLogsDir, process.env)

  await runtime.init()

  t.after(async () => {
    await runtime.close()
  })

  const { services } = await runtime.getServices()

  assert.deepStrictEqual(
    services.map(service => service.id),
    ['dbApp', 'serviceApp', 'with-logger', 'multi-plugin-service', 'composerApp']
  )
})

test('parseInspectorOptions - throws if --inspect and --inspect-brk are both used', () => {
  assert.throws(() => {
    const cm = {
      args: { inspect: '', 'inspect-brk': '' },
      current: {}
    }

    parseInspectorOptions(cm)
  }, /--inspect and --inspect-brk cannot be used together/)
})

test('parseInspectorOptions - --inspect default settings', () => {
  const cm = {
    args: { inspect: '' },
    current: {}
  }

  parseInspectorOptions(cm)
  assert.deepStrictEqual(cm.current.inspectorOptions, {
    host: '127.0.0.1',
    port: 9229,
    breakFirstLine: false,
    watchDisabled: false
  })
})

test('parseInspectorOptions - --inspect-brk default settings', () => {
  const cm = {
    args: { 'inspect-brk': '' },
    current: {}
  }

  parseInspectorOptions(cm)
  assert.deepStrictEqual(cm.current.inspectorOptions, {
    host: '127.0.0.1',
    port: 9229,
    breakFirstLine: true,
    watchDisabled: false
  })
})

test('parseInspectorOptions - hot reloading is disabled if the inspector is used', () => {
  const cm1 = {
    args: { 'inspect-brk': '' },
    current: { watch: true }
  }

  parseInspectorOptions(cm1)
  assert.strictEqual(cm1.current.watch, false)

  const cm2 = {
    args: {},
    current: { watch: true }
  }

  parseInspectorOptions(cm2)
  assert.strictEqual(cm2.current.watch, true)
})

test('parseInspectorOptions - sets port to a custom value', () => {
  const cm = {
    args: { inspect: '6666' },
    current: {}
  }

  parseInspectorOptions(cm)
  assert.deepStrictEqual(cm.current.inspectorOptions, {
    host: '127.0.0.1',
    port: 6666,
    breakFirstLine: false,
    watchDisabled: false
  })
})

test('parseInspectorOptions - sets host and port to custom values', () => {
  const cm = {
    args: { inspect: '0.0.0.0:6666' },
    current: {}
  }

  parseInspectorOptions(cm)
  assert.deepStrictEqual(cm.current.inspectorOptions, {
    host: '0.0.0.0',
    port: 6666,
    breakFirstLine: false,
    watchDisabled: false
  })
})

test('parseInspectorOptions - throws if the host is empty', () => {
  assert.throws(() => {
    const cm = {
      args: { inspect: ':9229' },
      current: {}
    }

    parseInspectorOptions(cm)
  }, /Inspector host cannot be empty/)
})

test('parseInspectorOptions - differentiates valid and invalid ports', () => {
  ;['127.0.0.1:', 'foo', '1', '-1', '1023', '65536'].forEach(inspectFlag => {
    assert.throws(() => {
      const cm = {
        args: { inspect: inspectFlag },
        current: {}
      }

      parseInspectorOptions(cm)
    }, /Inspector port must be 0 or in range 1024 to 65535/)
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

test('same schemaOptions as @platformatic/service', async () => {
  assert.deepStrictEqual(platformaticRuntime.schemaOptions, platformaticService.schemaOptions)
})

test('correctly loads the watch value from a string', async () => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-watch-env.json')
  process.env.PLT_WATCH = 'true'
  const loaded = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  assert.strictEqual(loaded.configManager.current.watch, true)
})

test('correctly loads the watch value from a string', async () => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-watch-env.json')
  process.env.PLT_WATCH = 'false'
  const loaded = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  assert.strictEqual(loaded.configManager.current.watch, false)
})

test('defaults the service name to `main` if there is no package.json', async t => {
  const configFile = join(fixturesDir, 'dbAppNoPackageJson', 'platformatic.db.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticDatabase)
  const runtimeConfig = await wrapConfigInRuntimeConfig(config)
  const conf = runtimeConfig.current
  assert.strictEqual(conf.services.length, 1)
  assert.strictEqual(conf.services[0].id, 'main')
})

test('uses the name in package.json', async t => {
  const configFile = join(fixturesDir, 'dbAppWithMigrationError', 'platformatic.db.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticDatabase)
  const runtimeConfig = await wrapConfigInRuntimeConfig(config)
  const conf = runtimeConfig.current
  assert.strictEqual(conf.services.length, 1)
  assert.strictEqual(conf.services[0].id, 'mysimplename')
})

test('uses the name in package.json, removing the scope', async t => {
  const configFile = join(fixturesDir, 'dbApp', 'platformatic.db.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticDatabase)
  const runtimeConfig = await wrapConfigInRuntimeConfig(config)
  const conf = runtimeConfig.current
  assert.strictEqual(conf.services.length, 1)
  assert.strictEqual(conf.services[0].id, 'myname')
})

test('defaults name to `main` if package.json exists but has no name', async t => {
  const configFile = join(fixturesDir, 'dbAppNoName', 'platformatic.db.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticDatabase)
  const runtimeConfig = await wrapConfigInRuntimeConfig(config)
  const conf = runtimeConfig.current
  assert.strictEqual(conf.services.length, 1)
  assert.strictEqual(conf.services[0].id, 'main')
})

// Note, the file's runtime property purposely has invalid properties to make sure
// API usage excludes them despite of JSON schema validation
test('uses application runtime configuration, avoiding overriding of sensible properties', async t => {
  const configFile = join(fixturesDir, 'wrapped-runtime', 'platformatic.json')

  // Do not use loadConfig here, as the schema is purposefully invalid
  const config = await loadConfig({}, ['-c', configFile], platformaticDatabase, {}, true, null, { validation: false })

  const runtimeConfig = await wrapConfigInRuntimeConfig(config)
  const conf = runtimeConfig.current

  assert.ok(typeof conf.web, 'undefined')
  assert.ok(typeof conf.autoload, 'undefined')
  assert.ok(conf.watch === false)
  assert.deepStrictEqual(conf.server, { hostname: '127.0.0.1', port: 1234 })
  assert.deepStrictEqual(conf.services, [
    {
      config: configFile,
      dependencies: [],
      entrypoint: true,
      gitBranch: 'main',
      health: {},
      id: 'main',
      localServiceEnvVars: new Map(),
      localUrl: 'http://main.plt.local',
      path: dirname(configFile),
      sourceMaps: false,
      type: 'db',
      watch: false,
      skipTelemetryHooks: true
    }
  ])
})

test('loads with the store', async t => {
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
      }
    }
  })

  await configManager.parseAndValidate(false)
})

test('set type on services', async t => {
  const cwd = process.cwd()
  process.chdir(join(fixturesDir, 'configs'))
  t.after(() => {
    process.chdir(cwd)
  })
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-node.json')

  const store = new Store()
  store.add(platformaticRuntime)

  const { configManager } = await store.loadConfig({
    config: configFile,
    overrides: {
      fixPaths: false,
      onMissingEnv (key) {
        return '{' + key + '}'
      }
    }
  })

  await configManager.parseAndValidate(false)
  const config = configManager.current

  const dbApp = config.serviceMap.get('db-app')
  const serviceApp = config.serviceMap.get('serviceApp')
  const nodeApp = config.serviceMap.get('node')

  assert.strictEqual(dbApp.type, 'db')
  assert.strictEqual(serviceApp.type, 'service')
  assert.strictEqual(nodeApp.type, 'nodejs')
})

test('supports configurable envfile location', async t => {
  const configFile = join(fixturesDir, 'env-config', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const dirname = config.configManager.dirname
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)

  const runtime = new Runtime(config.configManager, runtimeLogsDir, process.env)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  await runtime.start()

  const { payload } = await runtime.inject('hello', {
    method: 'GET',
    url: '/'
  })
  const data = JSON.parse(payload)

  assert.deepStrictEqual(data, {
    FROM_ENV_FILE: 'true',
    FROM_MAIN_CONFIG_FILE: 'true',
    FROM_SERVICE_CONFIG_FILE: 'true',
    OVERRIDE_TEST: 'service-override'
  })
})

test('supports default envfile location', async t => {
  const configFile = join(fixturesDir, 'env-service', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const dirname = config.configManager.dirname
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)

  const runtime = new Runtime(config.configManager, runtimeLogsDir, process.env)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  await runtime.start()

  const { payload } = await runtime.inject('hello', {
    method: 'GET',
    url: '/'
  })
  const data = JSON.parse(payload)

  assert.deepStrictEqual(data, {
    FROM_ENV_FILE: 'true',
    FROM_MAIN_CONFIG_FILE: 'true',
    FROM_SERVICE_CONFIG_FILE: 'true',
    OVERRIDE_TEST: 'service-override'
  })
})

test('supports configurable arguments', async t => {
  const configFile = join(fixturesDir, 'custom-argv', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const dirname = config.configManager.dirname
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)

  const runtime = new Runtime(config.configManager, runtimeLogsDir, process.env)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  await runtime.start()

  const workerMain = resolve(__dirname, '../lib/worker/main.js')

  {
    const { payload } = await runtime.inject('a', {
      method: 'GET',
      url: '/'
    })
    const data = JSON.parse(payload)

    assert.deepStrictEqual(data, [process.argv[0], workerMain, 'first', 'second', 'third'])
  }

  {
    const { payload } = await runtime.inject('b', {
      method: 'GET',
      url: '/'
    })

    const data = JSON.parse(payload)

    assert.deepStrictEqual(data, [process.argv[0], workerMain, ...process.argv.slice(2)])
  }
})

test('should manage service config patch', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-node.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const dirname = config.configManager.dirname
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)

  const runtime = new Runtime(config.configManager, runtimeLogsDir, process.env)

  runtime.setServiceConfigPatch('node', [{ op: 'replace', path: '/node/main', value: 'alternate.mjs' }])
  runtime.setServiceConfigPatch('serviceApp', [{ op: 'replace', path: '/plugins', value: { paths: ['alternate.js'] } }])

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  await runtime.start()

  {
    const { payload } = await runtime.inject('node', {
      method: 'GET',
      url: '/'
    })

    const data = JSON.parse(payload)

    assert.deepStrictEqual(data, { alternate: true })
  }

  {
    const { payload } = await runtime.inject('serviceApp', {
      method: 'GET',
      url: '/'
    })

    const data = JSON.parse(payload)

    assert.deepStrictEqual(data, { alternate: true })
  }
})
