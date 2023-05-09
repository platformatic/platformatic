'use strict'
const assert = require('node:assert')
const { spawn } = require('node:child_process')
const { join } = require('node:path')
const { test } = require('node:test')
const {
  buildServer,
  getConfigType,
  loadConfig
} = require('..')
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
})

test('start()', async (t) => {
  await t.test('can start a service server', (t) => {
    return new Promise((resolve, reject) => {
      const scriptFile = join(fixturesDir, 'starter.js')
      const configFile = join(fixturesDir, 'serviceApp', 'platformatic.service.json')
      const child = spawn(process.execPath, [scriptFile, configFile])

      child.on('error', reject)
      child.on('exit', (exitCode) => {
        if (exitCode === 42) {
          resolve()
        } else {
          reject(new Error(`unexpected exit code: ${exitCode}`))
        }
      })
    })
  })

  await t.test('can start a db server', (t) => {
    return new Promise((resolve, reject) => {
      const scriptFile = join(fixturesDir, 'starter.js')
      const configFile = join(fixturesDir, 'dbApp', 'platformatic.db.json')
      const child = spawn(process.execPath, [scriptFile, configFile])

      child.on('error', reject)
      child.on('exit', (exitCode) => {
        if (exitCode === 42) {
          resolve()
        } else {
          reject(new Error(`unexpected exit code: ${exitCode}`))
        }
      })
    })
  })
})

test('startCommand()', async (t) => {
  await t.test('can start a server', (t) => {
    return new Promise((resolve, reject) => {
      const scriptFile = join(fixturesDir, 'start-command.js')
      const configFile = join(fixturesDir, 'serviceApp', 'platformatic.service.json')
      const child = spawn(process.execPath, [scriptFile, configFile])

      child.on('error', reject)
      child.on('exit', (exitCode) => {
        if (exitCode === 42) {
          resolve()
        } else {
          reject(new Error(`unexpected exit code: ${exitCode}`))
        }
      })
    })
  })

  await t.test('exits on error', (t) => {
    return new Promise((resolve, reject) => {
      const scriptFile = join(fixturesDir, 'start-command.js')
      const configFile = join(fixturesDir, 'serviceApp', 'platformatic.not-found.json')
      const child = spawn(process.execPath, [scriptFile, configFile])

      child.on('error', reject)
      child.on('exit', (exitCode) => {
        if (exitCode === 1) {
          resolve()
        } else {
          reject(new Error(`unexpected exit code: ${exitCode}`))
        }
      })
    })
  })
})
