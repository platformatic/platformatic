import { BaseCapability } from '@platformatic/basic'
import { deepStrictEqual, notStrictEqual, rejects, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { Controller } from '../lib/worker/controller.js'
import { configurationFileIn } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

/*
  What the v4 loader hands a worker: the capability's validated configuration as data, plus the
  module that validated it. Controller no longer reads a configuration file -- that resolution
  moved main-side -- so a test that constructs one directly supplies what the loader would have.
*/
async function resolvedConfigurationIn (directory) {
  const file = configurationFileIn(directory)
  const { default: configuration } = await import(pathToFileURL(file).href)

  return configuration
}

test('errors when starting an already started application (no logging)', async t => {
  const appPath = join(fixturesDir, 'service-app-no-logging')
  const resolvedConfig = await resolvedConfigurationIn(appPath)
  const config = {
    id: 'serviceApp',
    resolvedConfig,
    module: resolvedConfig.module,
    path: appPath,
    watch: true,
    dependencies: []
  }
  const app = new Controller({}, config)
  await app.init()

  t.after(app.stop.bind(app))
  await app.start()
  await rejects(async () => {
    await app.start()
  }, /Application is already started/)
})

test('errors when stopping an already stopped application', async t => {
  /*
    Not monorepo/serviceApp: that directory is autoloaded by v4 runtimes, and Controller reads
    a configuration file with the v3 loader, so it cannot serve both.
  */
  const appPath = join(fixturesDir, 'service-app-no-logging')
  const resolvedConfig = await resolvedConfigurationIn(appPath)
  const config = {
    id: 'serviceApp',
    resolvedConfig,
    module: resolvedConfig.module,
    path: appPath,
    watch: true,
    dependencies: []
  }
  const app = new Controller({}, config)
  await app.init()

  await rejects(async () => {
    await app.stop()
  }, /Application has not been started/)
})

/*
  There was a test here for the error a missing `{PLT_X}` produced. v4 has no placeholders: an unset
  variable is `undefined` and what happens next is written in the configuration file, so there is no
  substitution left to fail. `docs/reference/service/configuration.md` shows the guard that replaces
  it.
*/

test('logs errors during startup', async t => {
  // A copy of serviceAppThrowsOnStart, kept from when one directory could not serve both loaders.
  const appPath = join(fixturesDir, 'service-app-throws-v3')
  const resolvedConfig = await resolvedConfigurationIn(appPath)
  const config = {
    id: 'serviceAppThrowsOnStart',
    resolvedConfig,
    module: resolvedConfig.module,
    path: appPath,
    watch: true
  }
  const app = new Controller({}, config)

  let data = ''
  t.mock.method(process.stdout, 'write', chunk => {
    data += chunk
  })

  await rejects(async () => {
    await app.init()
    await app.start()
  }, /boom/)

  strictEqual(data.includes('Error: boom'), true)
})

test('returns application statuses', async t => {
  const appPath = join(fixturesDir, 'service-app-no-logging')
  const resolvedConfig = await resolvedConfigurationIn(appPath)
  const config = {
    id: 'serviceApp',
    resolvedConfig,
    module: resolvedConfig.module,
    path: appPath,
    watch: true,
    dependencies: []
  }
  const app = new Controller({}, config)
  await app.init()

  app.start()

  strictEqual(app.getStatus(), 'starting')
  notStrictEqual(app.capability, null)

  await once(app, 'started')

  strictEqual(app.getStatus(), 'started')
  notStrictEqual(app.capability, null)

  app.stop()

  strictEqual(app.getStatus(), 'started')
  notStrictEqual(app.capability, null)

  await once(app, 'stopped')

  strictEqual(app.getStatus(), 'stopped')
  notStrictEqual(app.capability, null)
})

test('can update status of a capability with updateStatus support', async t => {
  /*
    Not monorepo/serviceApp: that directory is autoloaded by v4 runtimes, and Controller reads
    a configuration file with the v3 loader, so it cannot serve both.
  */
  const appPath = join(fixturesDir, 'service-app-no-logging')
  const resolvedConfig = await resolvedConfigurationIn(appPath)

  const config = {
    id: 'serviceApp',
    resolvedConfig,
    module: resolvedConfig.module,
    path: appPath,
    watch: true,
    dependencies: []
  }

  const app = new Controller({}, config)
  app.capability = new BaseCapability('base', '0.1', appPath, {})
  app.capability._start = async function () {}

  await app.start()

  deepStrictEqual(app.capability.status, 'started')
})

test('can update status of a capability without updateStatus support', async t => {
  /*
    Not monorepo/serviceApp: that directory is autoloaded by v4 runtimes, and Controller reads
    a configuration file with the v3 loader, so it cannot serve both.
  */
  const appPath = join(fixturesDir, 'service-app-no-logging')
  const resolvedConfig = await resolvedConfigurationIn(appPath)

  const config = {
    id: 'serviceApp',
    resolvedConfig,
    module: resolvedConfig.module,
    path: appPath,
    watch: true,
    dependencies: []
  }

  const app = new Controller({}, config)
  app.capability = new BaseCapability('base', '0.1', appPath, {})
  app.capability._start = async function () {}
  delete app.capability.updateStatus

  await app.start()

  deepStrictEqual(app.capability.status, 'started')
})
