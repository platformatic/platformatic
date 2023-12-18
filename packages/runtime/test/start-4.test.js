'use strict'
const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const fs = require('fs/promises')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')
const os = require('os')

const tmpdir = os.tmpdir()

const why = require('why-is-node-running')
setTimeout(() => {
  console.log('-----------------start-4 - start')
  why()
  console.log('-----------------start-4 - end')
}, 40000).unref()

test('supports logging using a transport', async (t) => {
  console.log('start-4 started')
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
  console.log('start-4 finished')
})
