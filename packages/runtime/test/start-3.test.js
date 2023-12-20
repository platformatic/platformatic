'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { MessageChannel } = require('node:worker_threads')
const { loadConfig } = require('@platformatic/config')
const { platformaticDB } = require('@platformatic/db')
const { wrapConfigInRuntimeConfig } = require('../lib/config')
const { startWithConfig } = require('../lib/start')
const fixturesDir = join(__dirname, '..', 'fixtures')

const why = require('why-is-node-running')
setTimeout(() => {
  console.log('-----------------start-3 - start')
  why()
  console.log('-----------------start-3 - end')
}, 40000).unref()

test('logs errors during db migrations', async (t) => {
  console.log('start-3 started')
  const configFile = join(fixturesDir, 'dbAppWithMigrationError', 'platformatic.db.json')
  console.log('start-3 1.1')
  const config = await loadConfig({}, ['-c', configFile], platformaticDB)
  console.log('start-3 1.2')
  const runtimeConfig = await wrapConfigInRuntimeConfig(config)
  console.log('start-3 1.3')
  const { port1, port2 } = new MessageChannel()
  console.log('start-3 1.4')
  runtimeConfig.current.loggingPort = port2
  console.log('start-3 1.5')
  runtimeConfig.current.loggingMetadata = { foo: 1, bar: 2 }
  console.log('start-3 1.6')
  const runtime = await startWithConfig(runtimeConfig)
  console.log('start-3 1.7')
  const messages = []

  port1.on('message', (msg) => {
    messages.push(msg)
  })

  console.log('start-3 1.8')
  await assert.rejects(async () => {
    console.log('start-3 1.9')
    await runtime.start()
    console.log('start-3 1.10')
  }, /The runtime exited before the operation completed/)

  console.log('start-3 1.11')
  assert.strictEqual(messages.length, 2)
  console.log('start-3 1.12')
  assert.deepStrictEqual(messages[0].metadata, runtimeConfig.current.loggingMetadata)
  assert.strictEqual(messages[0].logs.length, 1)
  assert.match(messages[0].logs[0], /running 001.do.sql/)
  assert.deepStrictEqual(messages[1].metadata, runtimeConfig.current.loggingMetadata)
  assert.strictEqual(messages[1].logs.length, 1)
  assert.match(messages[1].logs[0], /near \\"fiddlesticks\\": syntax error/)
  console.log('start-3 finished')
})
