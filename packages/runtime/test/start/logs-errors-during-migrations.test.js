import { ok, rejects } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfiguration, Runtime } from '../../index.js'
import { getTempDir, readLogs } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('logs errors during db migrations', async t => {
  const applicationDirectory = join(fixturesDir, 'dbAppWithMigrationError')
  const root = await getTempDir()

  /*
    Built as an object rather than by wrapping a v3 configuration: v4 has no wrapping step, and a
    root assembled in memory is a first-class source now that object configurations load through
    the v4 pipeline.
  */
  const runtimeConfig = await loadConfiguration(applicationDirectory, {
    // No id: v4 derives it from the application's package.json, which is what the wrapping step it
    // replaced used to do.
    applications: [{ path: applicationDirectory }],
    restartOnError: 1000,
    logger: {
      transport: {
        target: 'pino/file',
        options: { destination: join(root, 'logs.txt') }
      }
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
    { code: 'PLT_DB_MIGRATE_ERROR' }
  )

  const messages = await readLogs(join(root, 'logs.txt'), 10000)
  ok(messages.some(m => m.msg.match(/running 001.do.sql/)))
  ok(messages.some(m => m.err?.message?.match(/near "fiddlesticks": syntax error/)))
  ok(messages.some(m => m.msg?.match(/Failed to start worker 5 of the application "mysimplename" after 5 attempts./)))
})
