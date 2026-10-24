import { deepStrictEqual, rejects, strictEqual, throws } from 'node:assert'
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { loadConfiguration, loadObjectConfiguration } from '@platformatic/foundation/loader'
import { configureExtensions, resolveExtensions } from '../lib/extensions.js'
import { events } from '../fixtures/extensions/extension-configure.js'

const root = join(import.meta.dirname, '../fixtures/extensions/configure')

async function configure (config, context) {
  const extensions = resolveExtensions(config, context)
  await configureExtensions(config, extensions, context)
}

test('resolution normalizes relative paths without importing or configuring extensions', () => {
  const config = { extensions: './not-imported.js' }
  const extensions = resolveExtensions(config, { root })

  strictEqual(config.extensions, join(root, 'not-imported.js'))
  deepStrictEqual(extensions, [{ path: config.extensions, options: {} }])
  deepStrictEqual(resolveExtensions({}, { root }), [])
})

test('loader awaits main-thread configuration before evaluating application files', async () => {
  events.length = 0
  const loaded = await loadConfiguration({
    configPath: join(root, 'watt.config.js'),
    realEnv: {},
    validateCapabilities: false,
    configure
  })

  deepStrictEqual(events.map(event => event.ids), [['a'], ['a']])
  deepStrictEqual(events.map(event => event.isMainThread), [true, true])
  strictEqual(loaded.config.applications[0].config.server.port, 12345)
  strictEqual(loaded.config.applications[0].workerEnv.CONFIGURE_ORDER, 'first-second')
})

test('object loading supports CommonJS configure and build opt-in', async () => {
  const source = {
    extensions: [{ path: '../extension-configure.cjs', options: { value: 'configured' } }],
    applications: [{ id: 'a', path: '../services/a' }]
  }
  const options = { root, source, realEnv: {}, validateCapabilities: false }
  const configured = await loadObjectConfiguration({ ...options, configure })
  strictEqual(configured.config.applications[0].workerEnv.CONFIGURE_CJS, 'configured')

  const configureBuild = (config, context) => configure(config, { ...context, build: true })
  const skipped = await loadObjectConfiguration({ ...options, configure: configureBuild })
  strictEqual(skipped.config.env, undefined)

  source.extensions[0].build = true
  const built = await loadObjectConfiguration({ ...options, configure: configureBuild })
  strictEqual(built.config.applications[0].workerEnv.CONFIGURE_CJS, 'configured')
})

test('invalid configure exports fail with an identifiable cause', async () => {
  await rejects(configure({ extensions: '../extension-configure-invalid.js' }, { root }), error => {
    strictEqual(error.code, 'PLT_RUNTIME_FAILED_TO_LOAD_EXTENSION')
    strictEqual(error.cause.code, 'PLT_RUNTIME_INVALID_EXTENSION_CONFIGURE')
    return true
  })
})

test('npm extensions resolve from the project and share their module with setup', async t => {
  const project = await mkdtemp(join(import.meta.dirname, 'npm-extension-'))
  t.after(() => rm(project, { recursive: true, force: true }))
  const packageRoot = join(project, 'node_modules/@test/runtime-extension')
  await mkdir(packageRoot, { recursive: true })
  await cp(join(root, '../npm-package'), packageRoot, { recursive: true })

  const config = {
    extensions: [
      'npm:@test/runtime-extension',
      { path: 'npm:@test/runtime-extension/monitoring', options: { value: 'configured' } }
    ]
  }
  const extensions = resolveExtensions(config, { root: project })

  strictEqual(config.extensions[0], join(packageRoot, 'index.js'))
  strictEqual(config.extensions[1].path, join(packageRoot, 'monitoring.cjs'))
  strictEqual(config.env, undefined)
  const imported = await import(pathToFileURL(config.extensions[0]))
  strictEqual(imported.setup(), 0)

  await configureExtensions(config, extensions, { root: project })
  strictEqual(config.env.CONFIGURE_NPM, 'configured')
  strictEqual(imported.setup(), 1)

  const single = { extensions: 'npm:@test/runtime-extension' }
  resolveExtensions(single, { root: project })
  strictEqual(single.extensions, join(packageRoot, 'index.js'))

  const object = { extensions: { path: 'npm:@test/runtime-extension', options: { value: 'single' } } }
  resolveExtensions(object, { root: project })
  strictEqual(object.extensions.path, join(packageRoot, 'index.js'))
  deepStrictEqual(object.extensions.options, { value: 'single' })
})

test('missing npm extensions report resolution failures and are skipped for builds', () => {
  const config = { extensions: 'npm:@test/missing-runtime-extension' }
  throws(() => resolveExtensions(config, { root }), error => {
    strictEqual(error.code, 'PLT_RUNTIME_FAILED_TO_LOAD_EXTENSION')
    strictEqual(error.cause.code, 'MODULE_NOT_FOUND')
    return true
  })

  deepStrictEqual(resolveExtensions(config, { root, build: true }), [])
  strictEqual(config.extensions, 'npm:@test/missing-runtime-extension')
})
