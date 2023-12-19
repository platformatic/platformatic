'use strict'
const assert = require('node:assert')
const { once } = require('node:events')
const { join } = require('node:path')
const { test } = require('node:test')
const { MessageChannel } = require('node:worker_threads')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('..')
const { startWithConfig } = require('../lib/start')
const fixturesDir = join(__dirname, '..', 'fixtures')

const why = require('why-is-node-running')
setTimeout(() => {
  console.log('-----------------start-1 - start')
  why()
  console.log('-----------------start-1 - end')
}, 40000).unref()

test('supports logging via message port', async (t) => {
  console.log('start-1 started')
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  console.log('start-1 1.1')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  console.log('start-1 1.2')
  const { port1, port2 } = new MessageChannel()
  console.log('start-1 1.3')
  config.configManager.current.loggingPort = port2
  config.configManager.current.loggingMetadata = { foo: 1, bar: 2 }
  console.log('start-1 1.4')
  const app = await buildServer(config.configManager.current)
  console.log('start-1 1.5')
  await app.start()
  console.log('start-1 1.6')

  t.after(async () => {
    console.log('close start-1.1')
    await app.close()
    console.log('close start-1.2')
  })

  console.log('start-1 1.7')
  const [msg] = await once(port1, 'message')
  console.log('start-1 1.8')

  assert.deepStrictEqual(msg.metadata, { foo: 1, bar: 2 })
  assert(Array.isArray(msg.logs))
  assert(msg.logs.length > 0)

  for (let i = 0; i < msg.logs.length; ++i) {
    // Verify that each log is valid JSON.
    JSON.parse(msg.logs[i])
  }
  console.log('start-1 finished')
})

test('can start with a custom environment', async (t) => {
  console.log('start-1 started')
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  console.log('start-1 2.1')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  console.log('start-1 2.2')
  const app = await startWithConfig(config.configManager, { A_CUSTOM_ENV_VAR: 'foobar' })
  console.log('start-1 2.3')

  t.after(async () => {
    console.log('close start-1 2.1')
    await app.close()
    console.log('close start-1 2.2')
  })

  console.log('start-1 2.4')
  const entryUrl = await app.start()
  console.log('start-1 2.5')
  const res = await request(entryUrl + '/env')
  console.log('start-1 2.6')

  assert.strictEqual(res.statusCode, 200)
  console.log('start-1 2.7')
  assert.deepStrictEqual(await res.body.json(), { A_CUSTOM_ENV_VAR: 'foobar' })
  console.log('start-1 finished')
})
