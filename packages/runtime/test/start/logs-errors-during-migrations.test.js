'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { MessageChannel } = require('node:worker_threads')
const { loadConfig } = require('@platformatic/config')
const { platformaticDB } = require('@platformatic/db')
const { wrapConfigInRuntimeConfig } = require('../../lib/config')
const { buildRuntime } = require('../../lib/start')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

// Unskip when these issues are resolved:
// * https://github.com/nodejs/node/issues/49344
// * https://github.com/nodejs/node/issues/47748
test('logs errors during db migrations', { skip: true }, async (t) => {
  const configFile = join(fixturesDir, 'dbAppWithMigrationError', 'platformatic.db.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticDB)
  const runtimeConfig = await wrapConfigInRuntimeConfig(config)
  const { port1, port2 } = new MessageChannel()
  runtimeConfig.current.loggingPort = port2
  runtimeConfig.current.loggingMetadata = { foo: 1, bar: 2 }
  const runtime = await buildRuntime(runtimeConfig)
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
  process.exitCode = 0
})
