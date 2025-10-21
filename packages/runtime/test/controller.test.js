import { BaseCapability } from '@platformatic/basic'
import { abstractLogger } from '@platformatic/foundation'
import { deepStrictEqual, notStrictEqual, rejects, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { Controller } from '../lib/worker/controller.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('errors when starting an already started application (no logging)', async t => {
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.no-logging.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
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
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
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
    entrypoint: true,
    watch: true
  }
  const app = new Controller({}, config)

  globalThis.platformatic = { logger: abstractLogger }

  await rejects(async () => {
    await app.init()
    await app.start()
  }, /The configuration does not validate against the configuration schema/)
})

test('Uses the server config if passed', async t => {
  const appPath = join(fixturesDir, 'server', 'runtime-server', 'services', 'echo')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    watch: true,
    dependencies: []
  }
  const serverConfig = {
    hostname: '127.0.0.1',
    port: '14242',
    logger: {
      level: 'info'
    }
  }
  const app = new Controller({}, config, 0, serverConfig)

  t.after(async function () {
    t.mock.restoreAll()
    await app.stop()
  })

  const promise = new Promise((resolve, reject) => {
    t.mock.method(process.stdout, 'write', message => {
      try {
        const log = JSON.parse(message)
        if (log.msg.includes('listening')) {
          if (log.msg.includes(serverConfig.port)) {
            resolve()
          } else {
            reject(new Error('wrong port'))
          }
        }
      } catch (err) {}
    })
  })

  await app.init()
  await app.start()
  await app.listen()

  await utimes(configFile, new Date(), new Date())
  await promise
})

test('logs errors during startup', async t => {
  const appPath = join(fixturesDir, 'serviceAppThrowsOnStart')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceAppThrowsOnStart',
    config: configFile,
    path: appPath,
    entrypoint: true,
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
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.no-logging.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
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

test('supports configuration overrides', async t => {
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    watch: true,
    dependencies: []
  }

  const app = new Controller({}, config)

  await app.init()

  app.updateContext({
    serverConfig: {
      keepAliveTimeout: 1,
      port: 2222
    }
  })

  const capabilityConfig = await app.capability.getConfig()
  strictEqual(capabilityConfig.server.keepAliveTimeout, 1)
  strictEqual(capabilityConfig.server.port, 2222)
})

test('can update status of a capability with updateStatus support', async t => {
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')

  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    watch: true,
    dependencies: []
  }

  const app = new Controller({}, config)
  app.capability = new BaseCapability('base', '0.1', appPath, {})
  app.capability.start = async function () {}

  await app.start()

  deepStrictEqual(app.capability.status, 'started')
})

test('can update status of a capability without updateStatus support', async t => {
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')

  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    watch: true,
    dependencies: []
  }

  const app = new Controller({}, config)
  app.capability = new BaseCapability('base', '0.1', appPath, {})
  app.capability.start = async function () {}
  delete app.capability.updateStatus

  await app.start()

  deepStrictEqual(app.capability.status, 'started')
})
