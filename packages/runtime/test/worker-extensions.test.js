import { safeRemove } from '@platformatic/foundation'
import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')
const dir = join(fixturesDir, 'worker-extensions')
// Temporary copies live inside the package so capability module resolution
// keeps working; test:cleanup removes this directory.
const tmpBase = join(import.meta.dirname, '..', 'tmp')

const DEFAULT_EXTENSION = { path: '../../extensions/add-header.mjs' }

// The two entrypoint capabilities and the config each needs. node runs in the
// worker thread; node-child runs a custom command in a child process.
const SERVICES = {
  node: () => ({
    $schema: 'https://schemas.platformatic.dev/@platformatic/node/2.0.0.json',
    node: { main: 'plugin.js' },
    application: {}
  }),
  'node-child': () => ({
    $schema: 'https://schemas.platformatic.dev/@platformatic/node/2.0.0.json',
    application: { commands: { production: 'node plugin.js', development: 'node plugin.js' } }
  })
}

// Copies the fixture to a fresh temporary directory and writes the run's
// configuration into the copy, so the tracked fixture files are never mutated.
// Returns the runtime config path in the copy.
async function prepareFixture (t, entrypoint, extensions) {
  await mkdir(tmpBase, { recursive: true })
  const root = await mkdtemp(join(tmpBase, 'worker-ext-'))
  t.after(() => safeRemove(root))
  await cp(dir, root, { recursive: true })

  const runtime = JSON.parse(await readFile(join(root, 'watt.json'), 'utf8'))
  runtime.entrypoint = entrypoint
  await writeFile(join(root, 'watt.json'), JSON.stringify(runtime, null, 2))

  for (const [name, build] of Object.entries(SERVICES)) {
    const svc = build()
    // The entrypoint under test gets the test's extensions; the other keeps the
    // default, so it is a valid application but its hook never fires.
    svc.application.workerExtensions = name === entrypoint ? extensions : DEFAULT_EXTENSION
    await writeFile(join(root, 'services', name, 'watt.json'), JSON.stringify(svc, null, 2))
  }

  return join(root, 'watt.json')
}

async function start (t, { entrypoint = 'node', extensions = DEFAULT_EXTENSION } = {}) {
  const configFile = await prepareFixture(t, entrypoint, extensions)

  const app = await createRuntime(configFile)
  t.after(() => app.close())

  await app.init()
  const url = await app.start()
  return { app, url }
}

// The core finding: the entrypoint HTTP server lives in the worker for in-thread
// capabilities and in a child process for child-process ones, so the extension
// point must be installed at both sites.
for (const entrypoint of ['node', 'node-child']) {
  test(`a worker extension adds a response header (${entrypoint})`, async t => {
    const { url } = await start(t, { entrypoint })

    const { statusCode, headers } = await request(url, { path: '/hello' })
    strictEqual(statusCode, 200)
    strictEqual(headers['x-worker-extension'], `${entrypoint}:true`)
  })
}

test('an extension receives its application id, entrypoint flag, config, options and logger', async t => {
  const { url } = await start(t, {
    entrypoint: 'node',
    extensions: { path: '../../extensions/context.mjs', options: { marker: 'hi' } }
  })

  const { headers } = await request(url, { path: '/hello' })
  const context = JSON.parse(Buffer.from(headers['x-extension-context'], 'base64').toString())

  strictEqual(context.applicationId, 'node')
  strictEqual(context.entrypoint, true)
  strictEqual(context.hasConfig, true)
  strictEqual(context.option, 'hi')
  strictEqual(context.hasLogger, true)
  // In-thread entrypoint: the capability is available.
  strictEqual(context.hasCapability, true)
})

test('the capability is available in-thread but not for a child-process entrypoint', async t => {
  const { url } = await start(t, {
    entrypoint: 'node-child',
    extensions: { path: '../../extensions/context.mjs', options: {} }
  })

  const { headers } = await request(url, { path: '/hello' })
  const context = JSON.parse(Buffer.from(headers['x-extension-context'], 'base64').toString())

  // A child-process capability runs elsewhere, so the extension has no capability.
  strictEqual(context.hasCapability, false)
})

test('several extensions run, and close in reverse order', async t => {
  const orderFile = join(tmpdir(), `worker-ext-order-${process.pid}-${Date.now()}.log`)
  t.after(() => safeRemove(orderFile))

  const { app } = await start(t, {
    entrypoint: 'node',
    extensions: [
      { path: '../../extensions/order.mjs', options: { label: 'a', orderFile } },
      { path: '../../extensions/order.mjs', options: { label: 'b', orderFile } }
    ]
  })

  const afterSetup = (await readFile(orderFile, 'utf8')).trim().split('\n')
  deepStrictEqual(afterSetup, ['setup:a', 'setup:b'])

  await app.close()
  const afterClose = (await readFile(orderFile, 'utf8')).trim().split('\n')
  deepStrictEqual(afterClose, ['setup:a', 'setup:b', 'close:b', 'close:a'])
})

test('a slow-loading extension is installed before a child-process app serves requests', async t => {
  // Guards the race: the child install must complete before the application's
  // server accepts requests, even when the extension module is slow to load.
  // node-child is the case, since its server runs in a separate process.
  const { url } = await start(t, {
    entrypoint: 'node-child',
    extensions: { path: '../../extensions/slow-load.mjs' }
  })

  const { headers } = await request(url, { path: '/hello' })
  strictEqual(headers['x-slow-extension'], 'loaded')
})

test('a command-based application loads each extension exactly once', async t => {
  // Regression: the worker thread must not also load the extension when the
  // capability runs in a child process, or setup would run twice.
  const orderFile = join(tmpdir(), `worker-ext-once-${process.pid}-${Date.now()}.log`)
  t.after(() => safeRemove(orderFile))

  const { app } = await start(t, {
    entrypoint: 'node-child',
    extensions: { path: '../../extensions/order.mjs', options: { label: 'once', orderFile } }
  })

  const setups = (await readFile(orderFile, 'utf8')).trim().split('\n').filter(l => l === 'setup:once')
  strictEqual(setups.length, 1, `setup should run once, ran ${setups.length} times`)

  await app.close()
})

test('a child-process extension close hook runs on shutdown', async t => {
  const orderFile = join(tmpdir(), `worker-ext-child-close-${process.pid}-${Date.now()}.log`)
  t.after(() => safeRemove(orderFile))

  const { app } = await start(t, {
    entrypoint: 'node-child',
    extensions: { path: '../../extensions/order.mjs', options: { label: 'child', orderFile } }
  })

  const afterStart = (await readFile(orderFile, 'utf8')).trim().split('\n')
  ok(afterStart.includes('setup:child'), 'the extension set up in the child')

  await app.close()

  // The close hook must run in the child on shutdown. A custom-command
  // application may run in more than one child process, so assert the hook ran
  // rather than a single exact sequence.
  const afterClose = (await readFile(orderFile, 'utf8')).trim().split('\n')
  ok(afterClose.includes('close:child'), `expected a close hook, got: ${JSON.stringify(afterClose)}`)
})

test('worker extensions are not loaded while building', async t => {
  const markerFile = join(tmpdir(), `worker-ext-build-${process.pid}-${Date.now()}.marker`)
  t.after(() => safeRemove(markerFile))

  // The entrypoint extension records that its setup ran.
  const configFile = await prepareFixture(t, 'node', { path: '../../extensions/marker.mjs', options: { markerFile } })

  const runtimeApp = await createRuntime(configFile, undefined, { build: true })
  t.after(() => runtimeApp.close())
  await runtimeApp.init()

  // init() spawns the workers; if the build guard is missing, the extension
  // setup would have run and written the marker.
  strictEqual(existsSync(markerFile), false)
})

test('a non-entrypoint application does not fire the request hook', async t => {
  // Make node-child the entrypoint; the node application is then not the
  // entrypoint, and its add-header extension must not run.
  const { url } = await start(t, { entrypoint: 'node-child' })

  const { headers } = await request(url, { path: '/hello' })
  // The entrypoint (node-child) header is present; the non-entrypoint (node)
  // one never gets a public request to hook.
  strictEqual(headers['x-worker-extension'], 'node-child:true')
})

test('workerExtensions works in a wrapped single-application config', async t => {
  // A wrapped config is one file that is both the capability config and the
  // runtime config. workerExtensions sits on the application block, read
  // directly, so it is unaffected by the runtime wrapper.
  const app = await createRuntime(join(fixturesDir, 'worker-extensions-wrapped', 'watt.json'))
  t.after(() => app.close())
  await app.init()
  const url = await app.start()

  const { statusCode, headers } = await request(url, { path: '/hello' })
  strictEqual(statusCode, 200)
  // The standalone application's id comes from its package name; the entrypoint
  // flag is what matters here.
  ok(headers['x-worker-extension']?.endsWith(':true'), `expected the extension header, got: ${headers['x-worker-extension']}`)
})

test('a TypeScript extension is loaded via type stripping', async t => {
  const { url } = await start(t, {
    entrypoint: 'node',
    extensions: { path: '../../extensions/ts-extension.mts' }
  })

  const { headers } = await request(url, { path: '/hello' })
  strictEqual(headers['x-ts-extension'], 'ok')
})

// A misconfigured extension is skipped, not fatal: the application still
// starts, just without that extension's effect. Crashing the entrypoint over a
// bad extension would only trigger the runtime's bootstrap-retry storm.
test('a missing extension file is skipped, and the application still starts', async t => {
  const { url } = await start(t, { entrypoint: 'node', extensions: { path: '../../extensions/does-not-exist.mjs' } })

  const { statusCode, headers } = await request(url, { path: '/hello' })
  strictEqual(statusCode, 200)
  strictEqual(headers['x-worker-extension'], undefined)
})

test('an extension whose default export is not a function is skipped', async t => {
  const { url } = await start(t, { entrypoint: 'node', extensions: { path: '../../extensions/not-a-function.mjs' } })

  const { statusCode, headers } = await request(url, { path: '/hello' })
  strictEqual(statusCode, 200)
  strictEqual(headers['x-worker-extension'], undefined)
})
