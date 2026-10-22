import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime, readLogs } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

const configFile = join(fixturesDir, 'missing-env-fallback', 'platformatic.json')

function warningsOf (logs, kind) {
  const fallback = 'have been replaced by a fallback value'

  return logs.filter(log => {
    if (typeof log.msg !== 'string' || !log.msg.includes('environment variables which are not set')) {
      return false
    }

    return kind === 'fallback' ? log.msg.includes(fallback) : !log.msg.includes(fallback)
  })
}

test('a placeholder naming another application resolves to its URL, and nothing else does', async t => {
  const runtime = await createRuntime(configFile)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  const { statusCode, body } = await runtime.inject('app-a', { method: 'GET', url: '/options' })
  strictEqual(statusCode, 200)

  deepStrictEqual(JSON.parse(body), {
    // app-b exists in the runtime, so PLT_APP_B_URL is the application it owns.
    peerUrl: 'http://app-b.plt.local',
    // No application is named "some-base" or "some-client-id", so these stay empty rather than
    // silently becoming the URL of an unrelated application.
    resolvedBaseUrl: '',
    resolvedClientId: '',
    // VALKEY_URL is a fragment of a connection string, not an application reference. Resolving it
    // would produce `valkey://http://app-a.plt.local`, which is what broke packages/next before.
    cacheUrl: 'valkey://'
  })
})

test('each missing environment variable is reported exactly once', async t => {
  const context = {}
  const runtime = await createRuntime(configFile, null, context)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()
  await runtime.close()

  const logs = await readLogs(context.logsPath, 0)

  // The application is configured twice per worker, but only the load it actually runs on reports.
  const missing = warningsOf(logs, 'missing').filter(log => log.name === 'app-a')
  strictEqual(missing.length, 1)

  for (const name of ['PLT_SOME_BASE_URL', 'PLT_SOME_CLIENT_ID', 'VALKEY_URL']) {
    strictEqual(missing[0].msg.includes(name), true, `expected ${name} in: ${missing[0].msg}`)
  }

  // A variable the runtime resolved for the user is still surfaced, separately, as a fallback.
  const fallback = warningsOf(logs, 'fallback').filter(log => log.name === 'app-a')
  strictEqual(fallback.length, 1)
  strictEqual(fallback[0].msg.includes('PLT_APP_B_URL'), true)
  strictEqual(missing[0].msg.includes('PLT_APP_B_URL'), false)
})
