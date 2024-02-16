'use strict'

const os = require('node:os')
const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const fs = require('fs/promises')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

const tmpdir = os.tmpdir()

// Transports use FinalizationRegistry, which is somewhat broken.
// * https://github.com/nodejs/node/issues/49344
// * https://github.com/nodejs/node/issues/47748
// are fixed
test('supports logging using a transport', { skip: true }, async (t) => {
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
  process.exitCode = 0
})
