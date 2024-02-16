'use strict'

const assert = require('node:assert')
const { once } = require('node:events')
const { join } = require('node:path')
const { test } = require('node:test')
const { MessageChannel } = require('node:worker_threads')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('supports logging via message port', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const { port1, port2 } = new MessageChannel()
  config.configManager.current.loggingPort = port2
  config.configManager.current.loggingMetadata = { foo: 1, bar: 2 }
  const app = await buildServer(config.configManager.current)
  await app.start()

  t.after(async () => {
    await app.close()
  })

  const [msg] = await once(port1, 'message')

  assert.deepStrictEqual(msg.metadata, { foo: 1, bar: 2 })
  assert(Array.isArray(msg.logs))
  assert(msg.logs.length > 0)

  for (let i = 0; i < msg.logs.length; ++i) {
    // Verify that each log is valid JSON.
    JSON.parse(msg.logs[i])
  }
  process.exitCode = 0
})
