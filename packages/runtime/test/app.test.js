'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { once } = require('node:events')
const { utimes } = require('node:fs/promises')
const { PlatformaticApp } = require('../lib/worker/app')
const fixturesDir = join(__dirname, '..', 'fixtures')
const pino = require('pino')
const split = require('split2')

function getLoggerAndStream () {
  const stream = split(JSON.parse)
  const logger = pino(stream)
  return { logger, stream }
}

test('errors when starting an already started application', async (t) => {
  const { logger } = getLoggerAndStream()
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    watch: true,
    dependencies: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']]),
  }
  const app = new PlatformaticApp(config, logger)
  await app.init()

  t.after(app.stop.bind(app))
  await app.start()
  await assert.rejects(async () => {
    await app.start()
  }, /Application is already started/)
})

test('errors when stopping an already stopped application', async (t) => {
  const { logger } = getLoggerAndStream()
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    watch: true,
    dependencies: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']]),
  }
  const app = new PlatformaticApp(config, logger)
  await app.init()

  await assert.rejects(async () => {
    await app.stop()
  }, /Application has not been started/)
})

test('supports configuration overrides', async (t) => {
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    watch: true,
    dependencies: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']]),
  }

  await t.test('throws on non-string config paths', async (t) => {
    const { logger } = getLoggerAndStream()
    config._configOverrides = new Map([[null, 5]])
    const app = new PlatformaticApp(config, logger)

    t.after(async () => {
      try {
        await app.stop()
      } catch {
        // Ignore. The server should be stopped if nothing went wrong.
      }
    })

    await assert.rejects(async () => {
      await app.init()
      await app.start()
    }, /Config path must be a string/)
  })

  await t.test('ignores invalid config paths', async (t) => {
    const { logger } = getLoggerAndStream()
    config._configOverrides = new Map([['foo.bar.baz', 5]])
    const app = new PlatformaticApp(config, logger)
    await app.init()

    t.after(async () => {
      try {
        await app.stop()
      } catch {
        // Ignore. The server should be stopped if nothing went wrong.
      }
    })

    await app.start()
  })

  await t.test('sets valid config paths', async (t) => {
    const { logger } = getLoggerAndStream()
    config._configOverrides = new Map([
      ['server.keepAliveTimeout', 1],
      ['server.port', 0],
      ['server.pluginTimeout', 99],
    ])
    const app = new PlatformaticApp(config, logger)
    await app.init()

    t.after(async () => {
      try {
        await app.stop()
      } catch {
        // Ignore. The server should be stopped if nothing went wrong.
      }
    })

    await app.start()
    assert.strictEqual(app.config.configManager.current.server.keepAliveTimeout, 1)
    assert.strictEqual(app.config.configManager.current.server.pluginTimeout, 99)
  })
})

test('logs errors if an env variable is missing', async (t) => {
  const { logger, stream } = getLoggerAndStream()
  const configFile = join(fixturesDir, 'no-env.service.json')
  const config = {
    id: 'no-env',
    config: configFile,
    path: fixturesDir,
    entrypoint: true,
    watch: true,
  }
  const app = new PlatformaticApp(config, logger)

  t.mock.method(process, 'exit', () => {
    throw new Error('exited')
  })

  await assert.rejects(async () => {
    await app.init()
    await app.start()
  }, /exited/)
  assert.strictEqual(process.exit.mock.calls.length, 1)
  assert.strictEqual(process.exit.mock.calls[0].arguments[0], 1)

  stream.end()
  const lines = []
  for await (const line of stream) {
    lines.push(line)
  }
  const lastLine = lines[lines.length - 1]
  assert.strictEqual(lastLine.name, 'no-env')
  assert.strictEqual(lastLine.msg, 'Cannot parse config file. Cannot read properties of undefined (reading \'has\')')
})

test('Uses the server config if passed', async (t) => {
  const { logger, stream } = getLoggerAndStream()
  const appPath = join(fixturesDir, 'server', 'runtime-server', 'services', 'echo')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    watch: true,
    dependencies: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']]),
  }
  const serverConfig = {
    hostname: '127.0.0.1',
    port: '14242',
    logger: {
      level: 'info',
    },
  }
  const app = new PlatformaticApp(config, logger, null, serverConfig)

  t.after(async function () {
    try {
      await app.stop()
    } catch (err) {
      console.error(err)
    }
  })

  await app.init()
  await app.start()
  await app.listen()

  const configManager = app.config.configManager
  await utimes(configFile, new Date(), new Date())
  for await (const log of stream) {
    // Wait for the server to restart, it will print a line containing "Server listening"
    if (log.msg.includes('listening')) {
      if (log.msg.includes(serverConfig.port)) {
        break
      } else {
        throw new Error('wrong port')
      }
    }
  }
  assert.strictEqual(configManager, app.stackable.configManager)
})

// test('logs errors during startup', async (t) => {
//   const { logger, stream } = getLoggerAndStream()
//   const appPath = join(fixturesDir, 'serviceAppThrowsOnStart')
//   const configFile = join(appPath, 'platformatic.service.json')
//   const config = {
//     id: 'serviceAppThrowsOnStart',
//     config: configFile,
//     path: appPath,
//     entrypoint: true,
//     watch: true,
//   }
//   const app = new PlatformaticApp(config, logger)

//   t.mock.method(process, 'exit', () => { throw new Error('exited') })

//   await assert.rejects(async () => {
//     await app.init()
//     await app.start()
//   }, /exited/)
//   assert.strictEqual(process.exit.mock.calls.length, 1)
//   assert.strictEqual(process.exit.mock.calls[0].arguments[0], 1)

//   stream.end()
//   const lines = []
//   for await (const line of stream) {
//     lines.push(line)
//   }
//   const lastLine = lines[lines.length - 1]
//   assert.strictEqual(lastLine.msg, 'boom')
// })

test('returns application statuses', async (t) => {
  const { logger } = getLoggerAndStream()
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    watch: true,
    dependencies: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']]),
  }
  const app = new PlatformaticApp(config, logger)
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
