'use strict'
const assert = require('node:assert')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { join } = require('node:path')
const { test } = require('node:test')
const {
  buildServer,
  getConfigType,
  getCurrentSchema,
  loadConfig
} = require('..')
const { version } = require('../package.json')
const fixturesDir = join(__dirname, '..', 'fixtures')

test('getConfigType()', async (t) => {
  await t.test('throws if there is no $schema', async () => {
    const configFile = join(fixturesDir, 'no-schema.config.json')
    let err

    try {
      await getConfigType(['-c', configFile])
    } catch (error) {
      err = error
    }

    assert(err)
    assert.strictEqual(err.cause.message, 'configuration is missing a schema')
  })

  await t.test('throws if the schema type is unsupported', async () => {
    const configFile = join(fixturesDir, 'invalid-schema-type.config.json')
    let err

    try {
      await getConfigType(['-c', configFile])
    } catch (error) {
      err = error
    }

    assert(err)
    assert.strictEqual(err.cause.message, 'unknown configuration type: \'trickortreat\'')
  })

  await t.test('gets type from config via args', async () => {
    const configFile = join(fixturesDir, 'serviceApp', 'platformatic.service.json')
    const type = await getConfigType(['-c', configFile])

    assert.strictEqual(type, 'service')
  })

  await t.test('gets type from config in provided directory', async () => {
    const configDir = join(fixturesDir, 'serviceApp')
    const type = await getConfigType(undefined, configDir)

    assert.strictEqual(type, 'service')
  })

  await t.test('gets type from config in cwd', async (t) => {
    const cwd = process.cwd()

    t.after(() => {
      process.chdir(cwd)
    })

    const configDir = join(fixturesDir, 'dbApp')
    process.chdir(configDir)
    const type = await getConfigType()

    assert.strictEqual(type, 'db')
  })
})

test('getCurrentSchema()', async (t) => {
  await t.test('gets service schema', async () => {
    const schema = await getCurrentSchema('service')

    assert(schema.$id.endsWith(`/v${version}/service`))
  })

  await t.test('gets db schema', async () => {
    const schema = await getCurrentSchema('db')

    assert(schema.$id.endsWith(`/v${version}/db`))
  })

  await t.test('throws for unknown types', async () => {
    await assert.rejects(async () => {
      await getCurrentSchema('not-a-real-type')
    }, /unknown configuration type/)
  })
})

test('loadConfig()', async (t) => {
  await t.test('can explicitly provide config type', async () => {
    const configFile = join(fixturesDir, 'serviceApp', 'platformatic.service.json')
    const config = await loadConfig({}, ['-c', configFile], undefined, 'service')

    assert.strictEqual(config.args.config, configFile)
    assert.strictEqual(config.configManager.fullPath, configFile)
    assert.strictEqual(config.configManager.current.server.logger.name, 'hello server')
    assert.strictEqual(config.configManager.schemaOptions.useDefaults, true)
  })

  await t.test('throws if explicit type is wrong', async () => {
    // Prevent the failed validation from logging and exiting the process.
    t.mock.method(process, 'exit', () => {})
    t.mock.method(console, 'table', () => {})

    const configFile = join(fixturesDir, 'serviceApp', 'platformatic.service.json')

    await assert.rejects(async () => {
      await loadConfig({}, ['-c', configFile], undefined, 'db')
    })
  })

  await t.test('can load a platformatic service project', async () => {
    const configFile = join(fixturesDir, 'serviceApp', 'platformatic.service.json')
    const config = await loadConfig({}, ['-c', configFile])

    assert.strictEqual(config.args.config, configFile)
    assert.strictEqual(config.configManager.fullPath, configFile)
    assert.strictEqual(config.configManager.current.server.logger.name, 'hello server')
    assert.strictEqual(config.configManager.schemaOptions.useDefaults, true)
  })

  await t.test('can load a platformatic db project', async () => {
    const configFile = join(fixturesDir, 'dbApp', 'platformatic.db.json')
    const config = await loadConfig({}, ['-c', configFile])

    assert.strictEqual(config.args.config, configFile)
    assert.strictEqual(config.configManager.fullPath, configFile)
    assert.strictEqual(config.configManager.current.db.graphql, true)
  })
})

test('buildServer()', async (t) => {
  await t.test('can build a service server', async (t) => {
    const configFile = join(fixturesDir, 'serviceApp', 'platformatic.service.json')
    const config = await loadConfig({}, ['-c', configFile])
    const server = await buildServer(config.configManager.current)

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
    const server = await buildServer(config.configManager.current)

    t.after(async () => {
      await server.close()
    })

    const address = await server.start()
    // The address should be a valid URL.
    new URL(address) // eslint-disable-line no-new
  })

  await t.test('input can be a filename', async (t) => {
    const configFile = join(fixturesDir, 'serviceApp', 'platformatic.service.json')
    const server = await buildServer(configFile)

    t.after(async () => {
      await server.close()
    })

    const address = await server.start()
    // The address should be a valid URL.
    new URL(address) // eslint-disable-line no-new
  })
})

test('start()', async (t) => {
  await t.test('can start a service server', async (t) => {
    const scriptFile = join(fixturesDir, 'starter.js')
    const configFile = join(fixturesDir, 'serviceApp', 'platformatic.service.json')
    const child = spawn(process.execPath, [scriptFile, configFile])
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
})

test('startCommand()', async (t) => {
  await t.test('can start a server', async (t) => {
    const scriptFile = join(fixturesDir, 'start-command.js')
    const configFile = join(fixturesDir, 'serviceApp', 'platformatic.service.json')
    const child = spawn(process.execPath, [scriptFile, configFile])
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
})
