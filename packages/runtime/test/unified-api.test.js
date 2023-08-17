'use strict'
const assert = require('node:assert')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { join } = require('node:path')
const { test } = require('node:test')
const {
  buildServer,
  loadConfig
} = require('../lib/unified-api')
const fixturesDir = join(__dirname, '..', 'fixtures')

test('loadConfig()', async (t) => {
  await t.test('can explicitly provide config type', async () => {
    const configFile = join(fixturesDir, 'monorepo', 'serviceAppWithLogger', 'platformatic.service.json')
    const config = await loadConfig({}, ['-c', configFile], undefined, 'service')

    assert.strictEqual(config.args.config, configFile)
    assert.strictEqual(config.configManager.fullPath, configFile)
    assert.strictEqual(config.configManager.current.server.logger.name, 'service-with-logger')
    assert.strictEqual(config.configManager.schemaOptions.useDefaults, true)
  })

  await t.test('can load a platformatic service project', async () => {
    const configFile = join(fixturesDir, 'monorepo', 'serviceAppWithLogger', 'platformatic.service.json')
    const config = await loadConfig({}, ['-c', configFile])

    assert.strictEqual(config.args.config, configFile)
    assert.strictEqual(config.configManager.fullPath, configFile)
    assert.strictEqual(config.configManager.current.server.logger.name, 'service-with-logger')
    assert.strictEqual(config.configManager.schemaOptions.useDefaults, true)
  })

  await t.test('can load a platformatic db project', async () => {
    const configFile = join(fixturesDir, 'dbApp', 'platformatic.db.json')
    const config = await loadConfig({}, ['-c', configFile])

    assert.strictEqual(config.args.config, configFile)
    assert.strictEqual(config.configManager.fullPath, configFile)
    assert.strictEqual(config.configManager.current.db.graphql, true)
  })

  await t.test('can load a platformatic composer project', async () => {
    const configFile = join(fixturesDir, 'composerApp', 'platformatic.composer.json')
    const config = await loadConfig({}, ['-c', configFile])

    assert.strictEqual(config.args.config, configFile)
    assert.strictEqual(config.configManager.fullPath, configFile)
    assert.strictEqual(config.configManager.current.composer.refreshTimeout, 1000)
  })

  await t.test('can load a platformatic runtime project', async () => {
    const configFile = join(fixturesDir, 'configs', 'monorepo.json')
    const config = await loadConfig({}, ['-c', configFile])

    assert.strictEqual(config.args.config, configFile)
    assert.strictEqual(config.configManager.fullPath, configFile)
    assert.strictEqual(config.configManager.current.entrypoint, 'serviceApp')
  })
})

test('buildServer()', async (t) => {
  await t.test('can build a service server', async (t) => {
    const configFile = join(fixturesDir, 'monorepo', 'serviceAppWithLogger', 'platformatic.service.json')
    const config = await loadConfig({}, ['-c', configFile])
    const server = await buildServer({
      app: config.app,
      ...config.configManager.current
    })

    t.after(async () => {
      await server.close()
    })

    const address = await server.start()
    // The address should be a valid URL.
    new URL(address) // eslint-disable-line no-new
  })

  await t.test('can build a db server', async (t) => {
    const configFile = join(fixturesDir, 'dbApp', 'platformatic.db.json')
    const config = await loadConfig({}, ['-c', configFile])
    const server = await buildServer({
      app: config.app,
      ...config.configManager.current
    })

    t.after(async () => {
      await server.close()
    })

    const address = await server.start()
    // The address should be a valid URL.
    new URL(address) // eslint-disable-line no-new
  })

  await t.test('can build a composer server', async (t) => {
    const configFile = join(fixturesDir, 'composerApp', 'platformatic.composer.json')
    const config = await loadConfig({}, ['-c', configFile])
    const server = await buildServer({
      app: config.app,
      ...config.configManager.current
    })

    t.after(async () => {
      await server.close()
    })

    const address = await server.start()
    // The address should be a valid URL.
    new URL(address) // eslint-disable-line no-new
  })

  await t.test('can build a runtime application', async (t) => {
    const configFile = join(fixturesDir, 'configs', 'monorepo.json')
    const config = await loadConfig({}, ['-c', configFile])
    const server = await buildServer({
      app: config.app,
      ...config.configManager.current
    })

    t.after(async () => {
      await server.close()
    })

    const address = await server.start()
    // The address should be a valid URL.
    new URL(address) // eslint-disable-line no-new
  })

  await t.test('input can be a filename', async (t) => {
    const configFile = join(fixturesDir, 'monorepo', 'serviceAppWithLogger', 'platformatic.service.json')
    const server = await buildServer(configFile)

    t.after(async () => {
      await server.close()
    })

    const address = await server.start()

    assert.strictEqual(server.platformatic.configManager.fullPath, configFile)

    // The address should be a valid URL.
    new URL(address) // eslint-disable-line no-new
  })
})

test('start()', async (t) => {
  await t.test('can start a service server', async (t) => {
    const scriptFile = join(fixturesDir, 'starter.js')
    const configFile = join(fixturesDir, 'monorepo', 'serviceAppWithLogger', 'platformatic.service.json')
    const child = spawn(process.execPath, [scriptFile, configFile])
    child.stderr.pipe(process.stderr)
    const [exitCode] = await once(child, 'exit')

    assert.strictEqual(exitCode, 42)
  })

  await t.test('can start a db server', async (t) => {
    const scriptFile = join(fixturesDir, 'starter.js')
    const configFile = join(fixturesDir, 'dbApp', 'platformatic.db.json')
    const child = spawn(process.execPath, [scriptFile, configFile])
    const [exitCode] = await once(child, 'exit')

    assert.strictEqual(exitCode, 42)
  })

  await t.test('can start a composer server', async () => {
    const scriptFile = join(fixturesDir, 'starter.js')
    const configFile = join(fixturesDir, 'composerApp', 'platformatic.composer.json')
    const child = spawn(process.execPath, [scriptFile, configFile])
    const [exitCode] = await once(child, 'exit')

    assert.strictEqual(exitCode, 42)
  })

  await t.test('can start a runtime application', async () => {
    const scriptFile = join(fixturesDir, 'starter.js')
    const configFile = join(fixturesDir, 'configs', 'monorepo.json')
    const child = spawn(process.execPath, [scriptFile, configFile])
    const [exitCode] = await once(child, 'exit')

    assert.strictEqual(exitCode, 42)
  })
})

test('startCommand()', async (t) => {
  await t.test('can start a server', async (t) => {
    const scriptFile = join(fixturesDir, 'start-command.js')
    const configFile = join(fixturesDir, 'monorepo', 'serviceAppWithLogger', 'platformatic.service.json')
    const child = spawn(process.execPath, [scriptFile, configFile])
    child.stderr.pipe(process.stderr)
    const [exitCode] = await once(child, 'exit')

    assert.strictEqual(exitCode, 42)
  })

  await t.test('exits on error', async (t) => {
    const scriptFile = join(fixturesDir, 'start-command.js')
    const configFile = join(fixturesDir, 'serviceApp', 'platformatic.not-found.json')
    const child = spawn(process.execPath, [scriptFile, configFile])
    const [exitCode] = await once(child, 'exit')

    assert.strictEqual(exitCode, 1)
  })

  await t.test('can start a runtime application', async (t) => {
    const scriptFile = join(fixturesDir, 'start-command.js')
    const configFile = join(fixturesDir, 'configs', 'monorepo.json')
    const child = spawn(process.execPath, [scriptFile, configFile])
    child.stderr.pipe(process.stderr)
    const [exitCode] = await once(child, 'exit')

    assert.strictEqual(exitCode, 42)
  })

  await t.test('can start a non-runtime application', async (t) => {
    const scriptFile = join(fixturesDir, 'start-command-in-runtime.js')
    const configFile = join(fixturesDir, 'monorepo', 'serviceAppWithLogger', 'platformatic.service.json')
    const child = spawn(process.execPath, [scriptFile, configFile])
    child.stderr.pipe(process.stderr)
    const [exitCode] = await once(child, 'exit')

    assert.strictEqual(exitCode, 42)
  })

  await t.test('can start a runtime application', async (t) => {
    const scriptFile = join(fixturesDir, 'start-command-in-runtime.js')
    const configFile = join(fixturesDir, 'configs', 'monorepo.json')
    const child = spawn(process.execPath, [scriptFile, configFile])
    child.stderr.pipe(process.stderr)
    const [exitCode] = await once(child, 'exit')

    assert.strictEqual(exitCode, 42)
  })

  await t.test('exits on error', async (t) => {
    const scriptFile = join(fixturesDir, 'start-command-in-runtime.js')
    const configFile = join(fixturesDir, 'serviceApp', 'platformatic.not-found.json')
    const child = spawn(process.execPath, [scriptFile, configFile])
    const [exitCode] = await once(child, 'exit')

    assert.strictEqual(exitCode, 1)
  })

  await t.test('can start an application with external clients', async (t) => {
    const scriptFile = join(fixturesDir, 'start-command-in-runtime.js')
    const configFile = join(fixturesDir, 'external-client', 'platformatic.service.json')
    const child = spawn(process.execPath, [scriptFile, configFile])
    child.stderr.pipe(process.stderr)
    const [exitCode] = await once(child, 'exit')

    assert.strictEqual(exitCode, 42)
  })
})
