'use strict'
const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { MessageChannel } = require('node:worker_threads')
const fs = require('fs/promises')
const { loadConfig } = require('@platformatic/config')
const { platformaticDB } = require('@platformatic/db')
const { buildServer, platformaticRuntime } = require('..')
const { wrapConfigInRuntimeConfig } = require('../lib/config')
const { startWithConfig } = require('../lib/start')
const fixturesDir = join(__dirname, '..', 'fixtures')
const os = require('os')

const tmpdir = os.tmpdir()

test('logs errors during db migrations', async (t) => {
  const configFile = join(fixturesDir, 'dbAppWithMigrationError', 'platformatic.db.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticDB)
  const runtimeConfig = await wrapConfigInRuntimeConfig(config)
  const { port1, port2 } = new MessageChannel()
  runtimeConfig.current.loggingPort = port2
  runtimeConfig.current.loggingMetadata = { foo: 1, bar: 2 }
  const runtime = await startWithConfig(runtimeConfig)
  const messages = []

  port1.on('message', (msg) => {
    messages.push(msg)
  })

  await assert.rejects(async () => {
    await runtime.start()
  }, /The runtime exited before the operation completed/)

  assert.strictEqual(messages.length, 2)
  assert.deepStrictEqual(messages[0].metadata, runtimeConfig.current.loggingMetadata)
  assert.strictEqual(messages[0].logs.length, 1)
  assert.match(messages[0].logs[0], /running 001.do.sql/)
  assert.deepStrictEqual(messages[1].metadata, runtimeConfig.current.loggingMetadata)
  assert.strictEqual(messages[1].logs.length, 1)
  assert.match(messages[1].logs[0], /near \\"fiddlesticks\\": syntax error/)
})

test('supports logging using a transport', async (t) => {
  const configFile = join(fixturesDir, 'server', 'logger-transport', 'platformatic.runtime.json')
  const dest = join(tmpdir, `logger-transport-${process.pid}.log`)
  t.after(async function () {
    await fs.unlink(dest)
  })
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  config.configManager.current.server.logger.transport.options = {
    path: dest
  }
  const app = await buildServer(config.configManager.current)
  await app.start()
  await app.close()

  const written = await fs.readFile(dest, 'utf8')
  const parsed = JSON.parse(written)

  assert.strictEqual(parsed.fromTransport, true)
})
