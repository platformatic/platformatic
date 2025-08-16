'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { once } = require('node:events')
const { utimes } = require('node:fs/promises')
const { PlatformaticApp } = require('../lib/worker/app')
const fixturesDir = join(__dirname, '..', 'fixtures')

test('errors when starting an already started application', async t => {
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.no-logging.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    watch: true,
    dependencies: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']])
  }
  const app = new PlatformaticApp(config)
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
    dependencies: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']])
  }
  const app = new PlatformaticApp(config)
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
  const app = new PlatformaticApp(config)

  let error = ''
  t.mock.method(globalThis.platformatic.logger, 'error', obj => {
    error = obj.err
  })

  await assert.rejects(async () => {
    await app.init()
    await app.start()
  }, /has/)

  assert.strictEqual(
    error.message.includes("Cannot parse config file. Cannot read properties of undefined (reading 'has')"),
    true
  )
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
    dependencies: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']])
  }
  const serverConfig = {
    hostname: '127.0.0.1',
    port: '14242',
    logger: {
      level: 'info'
    }
  }
  const app = new PlatformaticApp(config, 0, null, null, serverConfig)

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
  const app = new PlatformaticApp(config)

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
    dependencies: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']])
  }
  const app = new PlatformaticApp(config)
  await app.init()

  app.start()

  assert.strictEqual(app.getStatus(), 'starting')
  assert.notStrictEqual(app.stackable, null)

  await once(app, 'start')

  assert.strictEqual(app.getStatus(), 'started')
  assert.notStrictEqual(app.stackable, null)

  app.stop()

  assert.strictEqual(app.getStatus(), 'started')
  assert.notStrictEqual(app.stackable, null)

  await once(app, 'stop')

  assert.strictEqual(app.getStatus(), 'stopped')
  assert.notStrictEqual(app.stackable, null)
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
    dependencies: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']])
  }

  const app = new PlatformaticApp(config)

  await app.init()

  app.updateContext({
    serverConfig: {
      keepAliveTimeout: 1,
      port: 2222
    }
  })

  const stackableConfig = await app.stackable.getConfig()
  assert.strictEqual(stackableConfig.server.keepAliveTimeout, 1)
  assert.strictEqual(stackableConfig.server.port, 2222)
})
