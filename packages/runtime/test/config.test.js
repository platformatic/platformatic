import { loadConfiguration as databaseLoadConfiguration } from '@platformatic/db'
import { deepStrictEqual, ok, rejects, strictEqual, throws } from 'node:assert'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { wrapInRuntimeConfig } from '../index.js'
import { parseInspectorOptions } from '../lib/config.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('throws if no entrypoint is found', async t => {
  const configFile = join(fixturesDir, 'configs', 'invalid-entrypoint.json')

  await rejects(async () => {
    await createRuntime(configFile)
  }, /Invalid entrypoint: 'invalid' does not exist/)
})

test('parseInspectorOptions - throws if --inspect and --inspect-brk are both used', () => {
  throws(() => {
    parseInspectorOptions({}, 'true', 'true')
  }, /--inspect and --inspect-brk cannot be used together/)
})

test('parseInspectorOptions - --inspect default settings', () => {
  const cm = {}

  parseInspectorOptions(cm, true)
  deepStrictEqual(cm.inspectorOptions, {
    host: '127.0.0.1',
    port: 9229,
    breakFirstLine: false,
    watchDisabled: false
  })
})

test('parseInspectorOptions - --inspect-brk default settings', () => {
  const cm = {}

  parseInspectorOptions(cm, undefined, true)
  deepStrictEqual(cm.inspectorOptions, {
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
  strictEqual(cm1.watch, false)

  const cm2 = {
    watch: true
  }

  parseInspectorOptions(cm2)
  strictEqual(cm2.watch, true)
})

test('parseInspectorOptions - sets port to a custom value', () => {
  const cm = {}

  parseInspectorOptions(cm, '6666')
  deepStrictEqual(cm.inspectorOptions, {
    host: '127.0.0.1',
    port: 6666,
    breakFirstLine: false,
    watchDisabled: false
  })
})

test('parseInspectorOptions - sets host and port to custom values', () => {
  const cm = {}

  parseInspectorOptions(cm, '0.0.0.0:6666')
  deepStrictEqual(cm.inspectorOptions, {
    host: '0.0.0.0',
    port: 6666,
    breakFirstLine: false,
    watchDisabled: false
  })
})

test('parseInspectorOptions - throws if the host is empty', () => {
  throws(() => {
    parseInspectorOptions({}, ':9229')
  }, /Inspector host cannot be empty/)
})

test('parseInspectorOptions - differentiates valid and invalid ports', () => {
  for (const inspectFlag of ['127.0.0.1:', 'foo', '1', '-1', '1023', '65536']) {
    throws(() => {
      parseInspectorOptions({}, inspectFlag)
    }, /Inspector port must be 0 or in range 1024 to 65535/)
  }

  const cm = {}

  parseInspectorOptions(cm, '0')
  strictEqual(cm.inspectorOptions.port, 0)

  parseInspectorOptions(cm, '1024')
  strictEqual(cm.inspectorOptions.port, 1024)

  parseInspectorOptions(cm, '1025')
  strictEqual(cm.inspectorOptions.port, 1025)

  parseInspectorOptions(cm, '65534')
  strictEqual(cm.inspectorOptions.port, 65534)

  parseInspectorOptions(cm, '65535')
  strictEqual(cm.inspectorOptions.port, 65535)
})

test('correctly loads the watch value from a string', async () => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-watch-env.json')
  process.env.PLT_WATCH = 'true'
  const runtime = await createRuntime(configFile)
  strictEqual((await runtime.getRuntimeConfig()).watch, true)
})

test('correctly loads the watch value from a string', async () => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-watch-env.json')
  process.env.PLT_WATCH = 'false'
  const runtime = await createRuntime(configFile)
  strictEqual((await runtime.getRuntimeConfig()).watch, false)
})

test('defaults the application name to `main` if there is no package.json', async t => {
  const configFile = join(fixturesDir, 'dbAppNoPackageJson', 'platformatic.db.json')
  const config = await databaseLoadConfiguration(configFile)
  const runtimeConfig = await wrapInRuntimeConfig(config)

  strictEqual(runtimeConfig.applications.length, 1)
  strictEqual(runtimeConfig.applications[0].id, 'main')
})

test('uses the name in package.json', async t => {
  const configFile = join(fixturesDir, 'dbAppWithMigrationError', 'platformatic.db.json')
  const config = await databaseLoadConfiguration(configFile)
  const runtimeConfig = await wrapInRuntimeConfig(config)

  strictEqual(runtimeConfig.applications.length, 1)
  strictEqual(runtimeConfig.applications[0].id, 'mysimplename')
})

test('uses the name in package.json, removing the scope', async t => {
  const configFile = join(fixturesDir, 'dbApp', 'platformatic.db.json')
  const config = await databaseLoadConfiguration(configFile)
  const runtimeConfig = await wrapInRuntimeConfig(config)
  strictEqual(runtimeConfig.applications.length, 1)
  strictEqual(runtimeConfig.applications[0].id, 'myname')
})

test('defaults name to `main` if package.json exists but has no name', async t => {
  const configFile = join(fixturesDir, 'dbAppNoName', 'platformatic.db.json')
  const config = await databaseLoadConfiguration(configFile)
  const runtimeConfig = await wrapInRuntimeConfig(config)

  strictEqual(runtimeConfig.applications.length, 1)
  strictEqual(runtimeConfig.applications[0].id, 'main')
})

test('uses application runtime configuration, avoiding overriding of sensible properties', async t => {
  const configFile = join(fixturesDir, 'wrapped-runtime', 'platformatic.json')

  const config = await databaseLoadConfiguration(configFile, null, { validate: false })
  const runtimeConfig = await wrapInRuntimeConfig(config)

  ok(typeof runtimeConfig.web, 'undefined')
  ok(typeof runtimeConfig.autoload, 'undefined')
  ok(runtimeConfig.watch === false)
  deepStrictEqual(runtimeConfig.server, { hostname: '127.0.0.1', port: 1234 })
  deepStrictEqual(runtimeConfig.applications, [
    {
      config: configFile,
      dependencies: [],
      entrypoint: true,
      gitBranch: 'main',
      health: {},
      id: 'main',
      localUrl: 'http://main.plt.local',
      path: dirname(configFile),
      reuseTcpPorts: true,
      type: '@platformatic/db',
      watch: false,
      skipTelemetryHooks: true,
      workers: {
        static: 1,
        dynamic: false
      }
    },
    {
      dependencies: [],
      entrypoint: false,
      gitBranch: 'main',
      health: {},
      id: 'another',
      localUrl: 'http://another.plt.local',
      path: resolve(dirname(configFile), 'another'),
      reuseTcpPorts: true,
      type: 'unknown',
      watch: false,
      workers: {
        static: 1,
        dynamic: false
      }
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

  deepStrictEqual(data, {
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

  deepStrictEqual(data, {
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

  const workerMain = resolve(import.meta.dirname, '../lib/worker/main.js')

  {
    const { payload } = await runtime.inject('a', {
      method: 'GET',
      url: '/'
    })
    const data = JSON.parse(payload)

    deepStrictEqual(data, [process.argv[0], workerMain, 'first', 'second', 'third'])
  }

  {
    const { payload } = await runtime.inject('b', {
      method: 'GET',
      url: '/'
    })

    const data = JSON.parse(payload)

    deepStrictEqual(data, [process.argv[0], workerMain, ...process.argv.slice(2)])
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

    deepStrictEqual(data, { alternate: true })
  }

  {
    const { payload } = await runtime.inject('serviceApp', {
      method: 'GET',
      url: '/'
    })

    const data = JSON.parse(payload)

    deepStrictEqual(data, { alternate: true })
  }
})

test('prepareApplication should not perform slow glob for services with url but no path', async t => {
  const { prepareApplication } = await import('../lib/config.js')
  const { kMetadata } = await import('@platformatic/foundation')
  const { mkdir, writeFile, rm } = await import('node:fs/promises')

  // Create a temporary directory with many JS files to simulate a large codebase
  // This will make the glob operation slow if it runs unnecessarily
  const tempDir = join(fixturesDir, 'temp-glob-test-' + Date.now())
  await mkdir(tempDir, { recursive: true })

  // Create subdirectories with many JS files (simulating external services)
  const numDirs = 20
  const filesPerDir = 50
  for (let i = 0; i < numDirs; i++) {
    const subDir = join(tempDir, `service-${i}`)
    await mkdir(subDir, { recursive: true })
    for (let j = 0; j < filesPerDir; j++) {
      await writeFile(join(subDir, `file-${j}.js`), '// test file')
    }
  }

  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  // Create a minimal config object with metadata pointing to the temp directory
  // This is the root that would be globbed if the bug exists
  const config = {
    [kMetadata]: {
      root: tempDir,
      env: {},
      path: null,
      module: '@platformatic/runtime'
    },
    entrypoint: 'service-with-url',
    watch: false
  }

  const defaultWorkers = { static: 1, dynamic: false }

  // Service with url but no path - simulates external service from git
  // BUG: When path is undefined, importCapabilityAndConfig(undefined) is called
  // which globs the cwd looking for JS files
  const application = {
    id: 'service-with-url',
    url: 'git@github.com:example/repo.git',
    gitBranch: 'main'
    // Note: no 'path' property - this is the problematic case
  }

  // Measure ONLY the prepareApplication call, not the test setup
  const startTime = performance.now()
  const result = await prepareApplication(config, application, defaultWorkers)
  const elapsed = performance.now() - startTime

  // Verify the application type is set to 'unknown'
  strictEqual(result.type, 'unknown', 'Application type should be "unknown" when path is missing')

  // Verify other expected properties are set
  strictEqual(result.entrypoint, true, 'Should be marked as entrypoint')
  deepStrictEqual(result.dependencies, [], 'Dependencies should default to empty array')
  strictEqual(result.localUrl, 'http://service-with-url.plt.local', 'localUrl should be set')
  strictEqual(result.watch, false, 'watch should inherit from config')

  // Services with url but no path should skip capability detection entirely
  // This means no file operations (glob, readFile, etc.) should be performed
  // The threshold is 10ms because we're only setting a few properties
  ok(elapsed < 10, `prepareApplication for url-only service should skip file operations (took ${elapsed.toFixed(2)}ms, expected < 10ms)`)
})

test('prepareApplication should handle multiple services with url but no path efficiently', async t => {
  const { prepareApplication } = await import('../lib/config.js')
  const { kMetadata } = await import('@platformatic/foundation')
  const { mkdir, writeFile, rm } = await import('node:fs/promises')

  // Create a temporary directory with many JS files
  const tempDir = join(fixturesDir, 'temp-glob-test-multi-' + Date.now())
  await mkdir(tempDir, { recursive: true })

  // Create subdirectories with many JS files
  const numDirs = 30
  const filesPerDir = 100
  for (let i = 0; i < numDirs; i++) {
    const subDir = join(tempDir, `service-${i}`)
    await mkdir(subDir, { recursive: true })
    for (let j = 0; j < filesPerDir; j++) {
      await writeFile(join(subDir, `file-${j}.js`), '// test file')
    }
  }

  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  const config = {
    [kMetadata]: {
      root: tempDir,
      env: {},
      path: null,
      module: '@platformatic/runtime'
    },
    entrypoint: 'service-1',
    watch: false
  }

  const defaultWorkers = { static: 1, dynamic: false }

  // Create multiple services with url but no path (like in watt.json with git repos)
  const services = []
  for (let i = 1; i <= 16; i++) {
    services.push({
      id: `service-${i}`,
      url: `git@github.com:example/repo-${i}.git`,
      gitBranch: 'main'
    })
  }

  // Measure ONLY the prepareApplication calls, not the test setup
  const startTime = performance.now()

  // Process all services
  const results = []
  for (const service of services) {
    results.push(await prepareApplication(config, { ...service }, defaultWorkers))
  }

  const elapsed = performance.now() - startTime

  // All services should have type 'unknown'
  for (const result of results) {
    strictEqual(result.type, 'unknown', `Service ${result.id} should have type "unknown"`)
  }

  // 16 services with url but no path should complete in under 50ms total
  // because they should skip capability detection entirely (no file operations)
  // With the bug, each service would trigger a glob operation on the temp directory
  ok(elapsed < 50, `Processing 16 url-only services should be fast (took ${elapsed.toFixed(2)}ms, expected < 50ms)`)
})
