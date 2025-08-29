import { loadConfiguration } from '@platformatic/db'
import { ok, rejects } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Runtime } from '../../index.js'
import { transform, wrapInRuntimeConfig } from '../../lib/config.js'
import { getTempDir, readLogs } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

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

  await rejects(
    async () => {
      await runtime.start()
    },
    { code: 'SQLITE_ERROR' }
  )

  const messages = await readLogs(join(root, 'logs.txt'), 10000)
  ok(messages.some(m => m.msg.match(/running 001.do.sql/)))
  ok(messages.some(m => m.err?.message?.match(/near "fiddlesticks": syntax error/)))
  ok(messages.some(m => m.msg?.match(/Failed to start application "mysimplename" after 5 attempts./)))
})
