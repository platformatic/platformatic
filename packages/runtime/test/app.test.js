'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { utimes } = require('node:fs/promises')
const { PlatformaticApp } = require('../lib/app')
const fixturesDir = join(__dirname, '..', 'fixtures')
const pino = require('pino')
const split = require('split2')

function getLoggerAndStream () {
  const stream = split(JSON.parse)
  const logger = pino(stream)
  return { logger, stream }
}

test('logs errors during startup', async (t) => {
  const { logger, stream } = getLoggerAndStream()
  const appPath = join(fixturesDir, 'serviceAppThrowsOnStart')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceAppThrowsOnStart',
    config: configFile,
    path: appPath,
    entrypoint: true,
    hotReload: true
  }
  const app = new PlatformaticApp(config, null, logger)

  t.mock.method(process, 'exit', () => { throw new Error('exited') })

  await assert.rejects(async () => {
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
  assert.strictEqual(lastLine.msg, 'boom')
})

test('errors when starting an already started application', async (t) => {
  const { logger } = getLoggerAndStream()
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    hotReload: true,
    dependencies: [],
    dependents: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']])
  }
  const app = new PlatformaticApp(config, null, logger)

  t.after(app.stop.bind(app))
  await app.start()
  await assert.rejects(async () => {
    await app.start()
  }, /application is already started/)
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
    hotReload: true,
    dependencies: [],
    dependents: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']])
  }
  const app = new PlatformaticApp(config, null, logger)

  await assert.rejects(async () => {
    await app.stop()
  }, /application has not been started/)
})

test('does not restart while restarting', async (t) => {
  const { logger } = getLoggerAndStream()
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    hotReload: true,
    dependencies: [],
    dependents: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']])
  }
  const app = new PlatformaticApp(config, null, logger)

  t.after(app.stop.bind(app))
  await app.start()
  t.mock.method(app, 'stop')
  await Promise.all([
    app.restart(),
    app.restart(),
    app.restart()
  ])

  // stop() should have only been called once despite three restart() calls.
  assert.strictEqual(app.stop.mock.calls.length, 1)
})

test('restarts on SIGUSR2', async (t) => {
  const { logger } = getLoggerAndStream()
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    hotReload: true,
    dependencies: [],
    dependents: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']])
  }
  const app = new PlatformaticApp(config, null, logger)

  t.after(app.stop.bind(app))
  await app.start()
  t.mock.method(app, 'restart')
  await app.handleProcessLevelEvent({ signal: 'SIGUSR2' })
  assert(app.restart.mock.calls.length)
})

test('stops on signals other than SIGUSR2', async (t) => {
  const { logger } = getLoggerAndStream()
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    hotReload: true,
    dependencies: [],
    dependents: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']])
  }
  const app = new PlatformaticApp(config, null, logger)

  t.after(async () => {
    try {
      await app.stop()
    } catch {
      // Ignore. The server should be stopped if nothing went wrong.
    }
  })
  await app.start()
  t.mock.method(app, 'stop')
  await app.handleProcessLevelEvent({ signal: 'SIGINT' })
  assert.strictEqual(app.stop.mock.calls.length, 1)
})

test('stops on uncaught exceptions', async (t) => {
  const { logger } = getLoggerAndStream()
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    hotReload: true,
    dependencies: [],
    dependents: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']])
  }
  const app = new PlatformaticApp(config, null, logger)

  t.after(async () => {
    try {
      await app.stop()
    } catch {
      // Ignore. The server should be stopped if nothing went wrong.
    }
  })
  await app.start()
  t.mock.method(app, 'stop')
  await app.handleProcessLevelEvent({ err: new Error('boom') })
  assert.strictEqual(app.stop.mock.calls.length, 1)
})

test('supports configuration overrides', async (t) => {
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    hotReload: true,
    dependencies: [],
    dependents: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']])
  }

  await t.test('throws on non-string config paths', async (t) => {
    const { logger } = getLoggerAndStream()
    config._configOverrides = new Map([[null, 5]])
    const app = new PlatformaticApp(config, null, logger)

    t.after(async () => {
      try {
        await app.stop()
      } catch {
        // Ignore. The server should be stopped if nothing went wrong.
      }
    })

    await assert.rejects(async () => {
      await app.start()
    }, /config path must be a string/)
  })

  await t.test('ignores invalid config paths', async (t) => {
    const { logger } = getLoggerAndStream()
    config._configOverrides = new Map([['foo.bar.baz', 5]])
    const app = new PlatformaticApp(config, null, logger)

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
      ['server.port', 0]
    ])
    const app = new PlatformaticApp(config, null, logger)

    t.after(async () => {
      try {
        await app.stop()
      } catch {
        // Ignore. The server should be stopped if nothing went wrong.
      }
    })

    await app.start()
    assert.strictEqual(app.config.configManager.current.server.keepAliveTimeout, 1)
  })
})

test('restarts on config change without overriding the configManager', async (t) => {
  const { logger, stream } = getLoggerAndStream()
  const appPath = join(fixturesDir, 'monorepo', 'serviceApp')
  const configFile = join(appPath, 'platformatic.service.json')
  const config = {
    id: 'serviceApp',
    config: configFile,
    path: appPath,
    entrypoint: true,
    hotReload: true,
    dependencies: [],
    dependents: [],
    localServiceEnvVars: new Map([['PLT_WITH_LOGGER_URL', ' ']])
  }
  const app = new PlatformaticApp(config, null, logger)

  t.after(async function () {
    try {
      await app.stop()
    } catch (err) {
      console.error(err)
    }
  })
  await app.start()
  const configManager = app.config.configManager
  await utimes(configFile, new Date(), new Date())
  let first = false
  for await (const log of stream) {
    // Wait for the server to restart, it will print a line containing "Server listening"
    if (log.msg.includes('listening')) {
      if (first) {
        break
      }
      first = true
    }
  }
  assert.strictEqual(configManager, app.server.platformatic.configManager)
})
