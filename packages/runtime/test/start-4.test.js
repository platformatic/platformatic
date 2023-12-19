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
  console.log('start-4 1.1')
  const dest = join(tmpdir, `logger-transport-${process.pid}.log`)
  console.log('start-4 1.2')
  t.after(async function () {
    console.log('start-4 1.3')
    await fs.unlink(dest)
    console.log('start-4 1.4')
  })
  console.log('start-4 1.5')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  console.log('start-4 1.6')
  config.configManager.current.server.logger.transport.options = {
    path: dest
  }
  console.log('start-4 1.7')
  const app = await buildServer(config.configManager.current)
  console.log('start-4 1.8')
  await app.start()
  console.log('start-4 1.9')
  await app.close()
  console.log('start-4 1.10')

  const written = await fs.readFile(dest, 'utf8')
  console.log('start-4 1.11')
  const parsed = JSON.parse(written)
  console.log('start-4 1.12')

  assert.strictEqual(parsed.fromTransport, true)
  console.log('start-4 finished')
})
