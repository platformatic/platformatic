'use strict'
const assert = require('node:assert')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { join } = require('node:path')
const { test } = require('node:test')
const { MessageChannel } = require('node:worker_threads')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('..')
const { startWithConfig } = require('../lib/start')
const fixturesDir = join(__dirname, '..', 'fixtures')

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
})

test('can start with a custom environment', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await startWithConfig(config.configManager, { A_CUSTOM_ENV_VAR: 'foobar' })

  t.after(async () => {
    await app.close()
  })

  const entryUrl = await app.start()
  const res = await request(entryUrl + '/env')

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), { A_CUSTOM_ENV_VAR: 'foobar' })
})

test('handles uncaught exceptions with db app', async (t) => {
  // Test for https://github.com/platformatic/platformatic/issues/1193
  const scriptFile = join(fixturesDir, 'start-command-in-runtime.js')
  const configFile = join(fixturesDir, 'dbApp', 'platformatic.db.json')
  const child = spawn(process.execPath, [scriptFile, configFile, '/async_crash'])
  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)
  const [exitCode] = await once(child, 'exit')

  assert.strictEqual(exitCode, 42)
})
