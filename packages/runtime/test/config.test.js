import { kMetadata } from '@platformatic/foundation'
import { deepStrictEqual, ok, rejects, strictEqual, throws } from 'node:assert'
import { existsSync } from 'node:fs'
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { loadConfiguration } from '../index.js'
import { parseInspectorOptions, prepareV4Application } from '../lib/config.js'
import { createRuntime, createTemporaryDirectory, configurationFileIn } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

/*
  The machine-generated plain-object form: a stamped configuration with no imports, which is what a
  deployment tool or the ICC emits. It used to be written here as JSON, which v4 does not read --
  the stamp said 4.0.0 and the file was a v3 document.
*/
async function writeStampedConfiguration (directory, configuration) {
  const file = join(directory, 'watt.config.js')

  await writeFile(
    file,
    `export default ${JSON.stringify({ $schema: 'https://schemas.platformatic.dev/wattpm/4.0.0.json', ...configuration }, null, 2)}\n`
  )

  return file
}

test('parseInspectorOptions - throws if --inspect and --inspect-brk are both used', () => {
  throws(() => {
    parseInspectorOptions({}, 'true', 'true')
  }, /--inspect and --inspect-brk cannot be used together/)
})

test('prepareApplication - resolves module source separately from writable application root', async t => {
  const root = await createTemporaryDirectory(t, 'module')
  const applicationPath = join(root, 'applications', 'module-app')
  const config = {
    [kMetadata]: {
      root: resolve(import.meta.dirname, '..')
    },
    watch: false
  }

  const application = await prepareV4Application(
    config,
    {
      id: 'module-app',
      path: applicationPath,
      module: '@platformatic/basic'
    },
    { static: 1, dynamic: false }
  )

  strictEqual(application.path, applicationPath)
  ok(application.sourcePath !== application.path)
  strictEqual(JSON.parse(await readFile(join(application.sourcePath, 'package.json'), 'utf8')).name, '@platformatic/basic')
  ok(existsSync(application.path))
})

test('prepareApplication - reports missing application modules with a coded error', async () => {
  await rejects(
    prepareV4Application(
      {
        [kMetadata]: { root: resolve(fixturesDir, 'missing') },
        watch: false
      },
      {
        id: 'missing-module',
        path: resolve(fixturesDir, 'missing', 'application'),
        module: '@platformatic/does-not-exist'
      },
      { static: 1, dynamic: false }
    ),
    error => error.code === 'PLT_RUNTIME_MISSING_DEPENDENCY'
  )
})

test('module applications invoke create with a separate writable root', async t => {
  const root = await createTemporaryDirectory(t, 'module-runtime')
  const nodeModules = join(root, 'node_modules')
  const packageScope = join(nodeModules, '@platformatic')
  const applicationPath = join(root, 'applications', 'module-app')
  const fixtureRoot = join(fixturesDir, 'module-application')
  const configFile = join(root, 'watt.config.js')

  await mkdir(packageScope, { recursive: true })
  await symlink(join(fixtureRoot, 'mock-application'), join(nodeModules, 'mock-application'), 'dir')
  await symlink(resolve(import.meta.dirname, '../node_modules/@platformatic/basic'), join(packageScope, 'basic'), 'dir')
  await symlink(resolve(import.meta.dirname, '../node_modules/@platformatic/service'), join(packageScope, 'service'), 'dir')
  await writeFile(
    configFile,
    `export default ${JSON.stringify({
      applications: [{ id: 'module-app', path: applicationPath, module: 'mock-application' }]
    })}\n`
  )

  const runtime = await createRuntime(configFile)
  t.after(() => runtime.close(true))

  await runtime.init()
  await runtime.start()

  const created = JSON.parse(await readFile(join(applicationPath, 'module-created.json'), 'utf8'))
  strictEqual(created.root, applicationPath)
  strictEqual(created.sourcePath, join(nodeModules, 'mock-application'))

  const response = await runtime.inject('module-app', { method: 'GET', url: '/module' })
  strictEqual(response.statusCode, 200)
  strictEqual(response.payload, JSON.stringify({ running: true }))
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

test('rejects root server configuration', async t => {
  const directory = await createTemporaryDirectory(t, 'runtime-config-schema')
  const configFile = await writeStampedConfiguration(directory, {
    applications: [{ id: 'main', path: '.' }],
    server: { port: 3042 }
  })

  await rejects(() => loadConfiguration(configFile), /must NOT have the additional property 'server'/)
})

test('rejects root entrypoint configuration', async t => {
  const directory = await createTemporaryDirectory(t, 'runtime-config-schema')
  const configFile = await writeStampedConfiguration(directory, {
    applications: [{ id: 'main', path: '.' }],
    entrypoint: 'main'
  })

  await rejects(() => loadConfiguration(configFile), /must NOT have the additional property 'entrypoint'/)
})

test('does not use application useHttp configuration', async t => {
  const directory = await createTemporaryDirectory(t, 'runtime-config-schema')
  const configFile = await writeStampedConfiguration(directory, {
    applications: [{ id: 'main', path: '.', useHttp: true }]
  })

  const config = await loadConfiguration(configFile)
  strictEqual(config.applications[0].exposed, undefined)
})

test('does not add application listener configuration', async t => {
  const directory = await createTemporaryDirectory(t, 'runtime-config-schema')
  const configFile = await writeStampedConfiguration(directory, { applications: [{ id: 'main', path: '.' }] })

  const config = await loadConfiguration(configFile)
  strictEqual(config.applications[0].exposed, undefined)
  strictEqual(config.applications[0].portEnv, undefined)
  strictEqual(config.applications[0].server, undefined)
})

test('correctly loads the watch value from a string', async () => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-watch-env', 'watt.config.mjs')
  process.env.PLT_WATCH = 'true'
  const runtime = await createRuntime(configFile)
  strictEqual((await runtime.getRuntimeConfig()).watch, true)
})

test('correctly loads the watch value from a string', async () => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-watch-env', 'watt.config.mjs')
  process.env.PLT_WATCH = 'false'
  const runtime = await createRuntime(configFile)
  strictEqual((await runtime.getRuntimeConfig()).watch, false)
})

test('defaults graceful shutdown timeouts', async () => {
  const configFile = join(fixturesDir, 'configs', 'graceful-shutdown-defaults', 'watt.config.mjs')
  const runtime = await createRuntime(configFile)
  const { gracefulShutdown } = await runtime.getRuntimeConfig()

  strictEqual(gracefulShutdown.runtime, 30000)
  strictEqual(gracefulShutdown.application, 10000)
})

/*
  `strictEnv` and the root `envfile` were removed in v4 -- there are no placeholders to be strict
  about, and env files are discovered by walking from the configuration to the project root rather
  than named. The four tests that covered them went with the v3 loader that implemented them; what
  replaces `strictEnv` is a guard the configuration writes for itself, which
  `docs/reference/service/configuration.md` shows.
*/

test('supports configurable arguments', async t => {
  const configFile = configurationFileIn(join(fixturesDir, 'custom-argv'))
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
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-node', 'watt.config.mjs')
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
