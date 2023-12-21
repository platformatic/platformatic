'use strict'

const os = require('node:os')
const assert = require('node:assert')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { join } = require('node:path')
const { test } = require('node:test')
const { MessageChannel } = require('node:worker_threads')
const { request } = require('undici')
const fs = require('fs/promises')
const { loadConfig } = require('@platformatic/config')
// const { platformaticDB } = require('@platformatic/db')
const { buildServer, platformaticRuntime } = require('..')
// const { wrapConfigInRuntimeConfig } = require('../lib/config')
const { startWithConfig } = require('../lib/start')
const fixturesDir = join(__dirname, '..', 'fixtures')

const tmpdir = os.tmpdir()

test('can start applications programmatically from object', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  const res = await request(entryUrl)

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
})

test('can start applications programmatically from string', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await buildServer(configFile)
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    // Basic URL on the entrypoint.
    const res = await request(entryUrl)

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
  }

  {
    // URL on the entrypoint that uses internal message passing.
    const res = await request(entryUrl + '/upstream')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { hello: 'world' })
  }
})

test('composer', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const res = await request(entryUrl)

    assert.strictEqual(res.statusCode, 200)
    const text = await res.body.text()
    console.log('--------------->', text)

    const data = JSON.parse(text)
    assert.deepStrictEqual(data, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }

  {
    const res = await request(entryUrl + '/service-app/')

    assert.strictEqual(res.statusCode, 200)

    const text = await res.body.text()
    console.log('--------------->', text)

    const data = JSON.parse(text)
    assert.deepStrictEqual(data, { hello: 'hello123' })
  }
})

test('can restart the runtime apps', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await buildServer(configFile)
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const res = await request(entryUrl + '/upstream')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { hello: 'world' })
  }

  await app.restart()

  {
    const res = await request(entryUrl + '/upstream')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { hello: 'world' })
  }
})

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

// Skipping until
// * https://github.com/nodejs/node/issues/49344
// * https://github.com/nodejs/node/issues/47748
// are fixed
test('handles uncaught exceptions with db app', async (t) => {
  // Test for https://github.com/platformatic/platformatic/issues/1193
  const scriptFile = join(fixturesDir, 'start-command-in-runtime.js')
  const configFile = join(fixturesDir, 'dbApp', 'platformatic.db.json')
  const child = spawn(process.execPath, [scriptFile, configFile, '/async_crash'])
  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)
  const [exitCode] = await once(child, 'exit')

  t.after(async () => {
    child.kill('SIGINT')
  })

  assert.strictEqual(exitCode, 42)
})

// test('logs errors during db migrations', async (t) => {
//   console.log('start-3 started')
//   const configFile = join(fixturesDir, 'dbAppWithMigrationError', 'platformatic.db.json')
//   const config = await loadConfig({}, ['-c', configFile], platformaticDB)
//   const runtimeConfig = await wrapConfigInRuntimeConfig(config)
//   const { port1, port2 } = new MessageChannel()
//   runtimeConfig.current.loggingPort = port2
//   runtimeConfig.current.loggingMetadata = { foo: 1, bar: 2 }
//   const runtime = await startWithConfig(runtimeConfig)
//   const messages = []

//   port1.on('message', (msg) => {
//     messages.push(msg)
//   })

//   await assert.rejects(async () => {
//     await runtime.start()
//   }, /The runtime exited before the operation completed/)

//   assert.strictEqual(messages.length, 2)
//   assert.deepStrictEqual(messages[0].metadata, runtimeConfig.current.loggingMetadata)
//   assert.strictEqual(messages[0].logs.length, 1)
//   assert.match(messages[0].logs[0], /running 001.do.sql/)
//   assert.deepStrictEqual(messages[1].metadata, runtimeConfig.current.loggingMetadata)
//   assert.strictEqual(messages[1].logs.length, 1)
//   assert.match(messages[1].logs[0], /near \\"fiddlesticks\\": syntax error/)
// })

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
