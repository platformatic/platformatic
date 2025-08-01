'use strict'

const os = require('node:os')
const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const fs = require('fs/promises')
const { create } = require('../..')
const { transform } = require('../../lib/config')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setTimeout: sleep } = require('node:timers/promises')
const tmpdir = os.tmpdir()
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('supports logging using a transport', async t => {
  const configFile = join(fixturesDir, 'server', 'logger-transport', 'platformatic.runtime.json')
  const dest = join(tmpdir, `logger-transport-${process.pid}.log`)

  t.after(async function () {
    await fs.unlink(dest)
    await app.close()
  })

  const app = await create(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.logger.transport.options = { path: dest }
      return config
    }
  })

  await app.start()

  // Wait for logs to be written
  await sleep(3000)

  const written = await fs.readFile(dest, 'utf8')

  for (const line of written.trim().split('\n')) {
    const parsed = JSON.parse(line)

    assert.strictEqual(parsed.fromTransport, true)
  }
})
