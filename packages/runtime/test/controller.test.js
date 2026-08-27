import { BaseCapability } from '@platformatic/basic'
import { abstractLogger } from '@platformatic/foundation'
import { updateGlobals } from '@platformatic/globals'
import { deepStrictEqual, notStrictEqual, rejects, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { Controller } from '../lib/worker/controller.js'
import { configurationFileIn } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('errors when starting an already started application (no logging)', async t => {
  const appPath = join(fixturesDir, 'service-app-no-logging')
  const configFile = configurationFileIn(appPath)
  const config = {
    id: 'serviceApp',
    config: configFile,
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
  const configFile = configurationFileIn(appPath)
  const config = {
    id: 'serviceApp',
    config: configFile,
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

test('logs errors if an env variable is missing', async t => {
  const configFile = join(fixturesDir, 'no-env.service.json')
  const config = {
    id: 'no-env',
    config: configFile,
    path: fixturesDir,
    watch: true
  }
  const app = new Controller({}, config)

  updateGlobals({ logger: abstractLogger })

  await rejects(async () => {
    await app.init()
    await app.start()
  }, /The configuration does not validate against the configuration schema/)
})

test('logs errors during startup', async t => {
  const appPath = join(fixturesDir, 'serviceAppThrowsOnStart')
  const configFile = configurationFileIn(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceAppThrowsOnStart',
    config: configFile,
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
  const configFile = configurationFileIn(appPath)
  const config = {
    id: 'serviceApp',
    config: configFile,
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
  const configFile = configurationFileIn(appPath)

  const config = {
    id: 'serviceApp',
    config: configFile,
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
  const configFile = configurationFileIn(appPath)

  const config = {
    id: 'serviceApp',
    config: configFile,
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
