'use strict'

const assert = require('node:assert')
const { join, resolve, dirname } = require('node:path')
const { test } = require('node:test')
const { parseInspectorOptions } = require('../lib/config')
const { wrapInRuntimeConfig } = require('../index.js')
const { createRuntime } = require('./helpers.js')
const fixturesDir = join(__dirname, '..', 'fixtures')
const { loadConfiguration: databaseLoadConfiguration } = require('@platformatic/db')

test('throws if no entrypoint is found', async t => {
  const configFile = join(fixturesDir, 'configs', 'invalid-entrypoint.json')

  await assert.rejects(async () => {
    await createRuntime(configFile)
  }, /Invalid entrypoint: 'invalid' does not exist/)
})

test('dependencies are not considered if applications are specified manually', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer-no-autoload.json')
  const runtime = await createRuntime(configFile)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  const { applications } = await runtime.getApplications()

  assert.deepStrictEqual(
    applications.map(application => application.id),
    ['with-logger', 'db-app', 'composerApp', 'multi-plugin-service', 'serviceApp']
  )
})

test('dependencies are resolved if applications are not specified manually', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer.json')
  const runtime = await createRuntime(configFile)

  await runtime.init()

  t.after(async () => {
    await runtime.close()
  })

  const { applications } = await runtime.getApplications()

  assert.deepStrictEqual(
    applications.map(application => application.id),
    ['dbApp', 'serviceApp', 'with-logger', 'multi-plugin-service', 'composerApp']
  )
})

test('parseInspectorOptions - throws if --inspect and --inspect-brk are both used', () => {
  assert.throws(() => {
    parseInspectorOptions({}, 'true', 'true')
  }, /--inspect and --inspect-brk cannot be used together/)
})

test('parseInspectorOptions - --inspect default settings', () => {
  const cm = {}

  parseInspectorOptions(cm, true)
  assert.deepStrictEqual(cm.inspectorOptions, {
    host: '127.0.0.1',
    port: 9229,
    breakFirstLine: false,
    watchDisabled: false
  })
})

test('parseInspectorOptions - --inspect-brk default settings', () => {
  const cm = {}

  parseInspectorOptions(cm, undefined, true)
  assert.deepStrictEqual(cm.inspectorOptions, {
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

  parseInspectorOptions(cm1, undefined, '9229')
  assert.strictEqual(cm1.watch, false)

  const cm2 = {
    watch: true
  }

  parseInspectorOptions(cm2)
  assert.strictEqual(cm2.watch, true)
})

test('parseInspectorOptions - sets port to a custom value', () => {
  const cm = {}

  parseInspectorOptions(cm, '6666')
  assert.deepStrictEqual(cm.inspectorOptions, {
    host: '127.0.0.1',
    port: 6666,
    breakFirstLine: false,
    watchDisabled: false
  })
})

test('parseInspectorOptions - sets host and port to custom values', () => {
  const cm = {}

  parseInspectorOptions(cm, '0.0.0.0:6666')
  assert.deepStrictEqual(cm.inspectorOptions, {
    host: '0.0.0.0',
    port: 6666,
    breakFirstLine: false,
    watchDisabled: false
  })
})

test('parseInspectorOptions - throws if the host is empty', () => {
  assert.throws(() => {
    parseInspectorOptions({}, ':9229')
  }, /Inspector host cannot be empty/)
})

test('parseInspectorOptions - differentiates valid and invalid ports', () => {
  for (const inspectFlag of ['127.0.0.1:', 'foo', '1', '-1', '1023', '65536']) {
    assert.throws(() => {
      parseInspectorOptions({}, inspectFlag)
    }, /Inspector port must be 0 or in range 1024 to 65535/)
  }

  const cm = {}

  parseInspectorOptions(cm, '0')
  assert.strictEqual(cm.inspectorOptions.port, 0)

  parseInspectorOptions(cm, '1024')
  assert.strictEqual(cm.inspectorOptions.port, 1024)

  parseInspectorOptions(cm, '1025')
  assert.strictEqual(cm.inspectorOptions.port, 1025)

  parseInspectorOptions(cm, '65534')
  assert.strictEqual(cm.inspectorOptions.port, 65534)

  parseInspectorOptions(cm, '65535')
  assert.strictEqual(cm.inspectorOptions.port, 65535)
})

test('correctly loads the watch value from a string', async () => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-watch-env.json')
  process.env.PLT_WATCH = 'true'
  const runtime = await createRuntime(configFile)
  assert.strictEqual((await runtime.getRuntimeConfig()).watch, true)
})

test('correctly loads the watch value from a string', async () => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-watch-env.json')
  process.env.PLT_WATCH = 'false'
  const runtime = await createRuntime(configFile)
  assert.strictEqual((await runtime.getRuntimeConfig()).watch, false)
})

test('defaults the application name to `main` if there is no package.json', async t => {
  const configFile = join(fixturesDir, 'dbAppNoPackageJson', 'platformatic.db.json')
  const config = await databaseLoadConfiguration(configFile)
  const runtimeConfig = await wrapInRuntimeConfig(config)

  assert.strictEqual(runtimeConfig.applications.length, 1)
  assert.strictEqual(runtimeConfig.applications[0].id, 'main')
})

test('uses the name in package.json', async t => {
  const configFile = join(fixturesDir, 'dbAppWithMigrationError', 'platformatic.db.json')
  const config = await databaseLoadConfiguration(configFile)
  const runtimeConfig = await wrapInRuntimeConfig(config)

  assert.strictEqual(runtimeConfig.applications.length, 1)
  assert.strictEqual(runtimeConfig.applications[0].id, 'mysimplename')
})

test('uses the name in package.json, removing the scope', async t => {
  const configFile = join(fixturesDir, 'dbApp', 'platformatic.db.json')
  const config = await databaseLoadConfiguration(configFile)
  const runtimeConfig = await wrapInRuntimeConfig(config)
  assert.strictEqual(runtimeConfig.applications.length, 1)
  assert.strictEqual(runtimeConfig.applications[0].id, 'myname')
})

test('defaults name to `main` if package.json exists but has no name', async t => {
  const configFile = join(fixturesDir, 'dbAppNoName', 'platformatic.db.json')
  const config = await databaseLoadConfiguration(configFile)
  const runtimeConfig = await wrapInRuntimeConfig(config)

  assert.strictEqual(runtimeConfig.applications.length, 1)
  assert.strictEqual(runtimeConfig.applications[0].id, 'main')
})

test('uses application runtime configuration, avoiding overriding of sensible properties', async t => {
  const configFile = join(fixturesDir, 'wrapped-runtime', 'platformatic.json')

  const config = await databaseLoadConfiguration(configFile, null, { validate: false })
  const runtimeConfig = await wrapInRuntimeConfig(config)

  assert.ok(typeof runtimeConfig.web, 'undefined')
  assert.ok(typeof runtimeConfig.autoload, 'undefined')
  assert.ok(runtimeConfig.watch === false)
  assert.deepStrictEqual(runtimeConfig.server, { hostname: '127.0.0.1', port: 1234 })
  assert.deepStrictEqual(runtimeConfig.applications, [
    {
      config: configFile,
      dependencies: [],
      entrypoint: true,
      gitBranch: 'main',
      health: {},
      id: 'main',
      localUrl: 'http://main.plt.local',
      path: dirname(configFile),
      sourceMaps: false,
      type: '@platformatic/db',
      watch: false,
      skipTelemetryHooks: true
    },
    {
      dependencies: [],
      entrypoint: false,
      gitBranch: 'main',
      health: {},
      id: 'another',
      localUrl: 'http://another.plt.local',
      path: resolve(dirname(configFile), 'another'),
      sourceMaps: false,
      type: 'unknown',
      watch: false
    }
  ])
})

test('supports configurable envfile location', async t => {
  const configFile = join(fixturesDir, 'env-config', 'platformatic.json')
  const runtime = await createRuntime(configFile)

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
  const runtime = await createRuntime(configFile)

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
  const runtime = await createRuntime(configFile)

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

test('should manage application config patch', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-node.json')
  const runtime = await createRuntime(configFile)

  runtime.setApplicationConfigPatch('node', [{ op: 'replace', path: '/node/main', value: 'alternate.mjs' }])
  runtime.setApplicationConfigPatch('serviceApp', [
    { op: 'replace', path: '/plugins', value: { paths: ['alternate.js'] } }
  ])

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
