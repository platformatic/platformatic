'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { loadConfiguration } = require('@platformatic/db')
const { wrapInRuntimeConfig, transform } = require('../../lib/config')
const { Runtime } = require('../../index')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { getTempDir, readLogs } = require('../helpers.js')

test('logs errors during db migrations', async t => {
  const configFile = join(fixturesDir, 'dbAppWithMigrationError', 'platformatic.db.json')
  const config = await loadConfiguration(configFile)
  const root = await getTempDir()

  const runtimeConfig = await wrapInRuntimeConfig(config, {
    async transform (config, ...args) {
      config = await transform(config, ...args)

      config.restartOnError = 1000

      config.logger.transport ??= {
        target: 'pino/file',
        options: { destination: join(root, 'logs.txt') }
      }

      return config
    }
  })

  const runtime = new Runtime(runtimeConfig)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()

  await assert.rejects(
    async () => {
      await runtime.start()
    },
    { code: 'SQLITE_ERROR' }
  )

  const messages = await readLogs(join(root, 'logs.txt'), 10000)
  assert.ok(messages.some(m => m.msg.match(/running 001.do.sql/)))
  assert.ok(messages.some(m => m.err?.message?.match(/near "fiddlesticks": syntax error/)))
  assert.ok(messages.some(m => m.msg?.match(/Failed to start application "mysimplename" after 5 attempts./)))
})
