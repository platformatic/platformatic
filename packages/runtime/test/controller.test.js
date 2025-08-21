'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { once } = require('node:events')
const { utimes } = require('node:fs/promises')
const { abstractLogger } = require('@platformatic/foundation')
const { Controller } = require('../lib/worker/controller')
const fixturesDir = join(__dirname, '..', 'fixtures')

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
  const app = new Controller(config)
  await app.init()

  t.after(app.stop.bind(app))
  await app.start()
  await assert.rejects(async () => {
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
  const app = new Controller(config)
  await app.init()

  await assert.rejects(async () => {
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
  const app = new Controller(config)

  globalThis.platformatic = { logger: abstractLogger }

  await assert.rejects(async () => {
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
  const app = new Controller(config, 0, null, null, serverConfig)

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
  const app = new Controller(config)

  let data = ''
  t.mock.method(process.stdout, 'write', chunk => {
    data += chunk
  })

  await assert.rejects(async () => {
    await app.init()
    await app.start()
  }, /boom/)

  assert.strictEqual(data.includes('Error: boom'), true)
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
  const app = new Controller(config)
  await app.init()

  app.start()

  assert.strictEqual(app.getStatus(), 'starting')
  assert.notStrictEqual(app.capability, null)

  await once(app, 'start')

  assert.strictEqual(app.getStatus(), 'started')
  assert.notStrictEqual(app.capability, null)

  app.stop()

  assert.strictEqual(app.getStatus(), 'started')
  assert.notStrictEqual(app.capability, null)

  await once(app, 'stop')

  assert.strictEqual(app.getStatus(), 'stopped')
  assert.notStrictEqual(app.capability, null)
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

  const app = new Controller(config)

  await app.init()

  app.updateContext({
    serverConfig: {
      keepAliveTimeout: 1,
      port: 2222
    }
  })

  const capabilityConfig = await app.capability.getConfig()
  assert.strictEqual(capabilityConfig.server.keepAliveTimeout, 1)
  assert.strictEqual(capabilityConfig.server.port, 2222)
})
