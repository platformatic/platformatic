import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime, readLogs } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

const configFile = join(fixturesDir, 'missing-env-fallback', 'platformatic.json')

function missingWarnings (logs) {
  return logs.filter(
    log => typeof log.msg === 'string' && log.msg.includes('environment variables which are not set')
  )
}

test('the configuration the application runs on is not altered by the application URL fallback', async t => {
  const runtime = await createRuntime(configFile)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  const { statusCode, body } = await runtime.inject('app-a', { method: 'GET', url: '/options' })
  strictEqual(statusCode, 200)

  // A missing variable is empty regardless of whether its name ends with _URL. In particular
  // `cacheUrl` shows why the fallback must not reach this load: the variable is a fragment of a
  // connection string, so substituting an application URL would produce `valkey://http://app-a.plt.local`.
  deepStrictEqual(JSON.parse(body), {
    resolvedBaseUrl: '',
    resolvedClientId: '',
    cacheUrl: 'valkey://'
  })
})

test('missing environment variables are reported once per application', async t => {
  const context = {}
  const runtime = await createRuntime(configFile, null, context)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()
  await runtime.close()

  const logs = await readLogs(context.logsPath, 0)
  const missing = missingWarnings(logs)

  // Before, the throwaway load reported the _URL variables as replaced by a fallback value and the
  // real load reported them as not set, so the same application warned twice, contradicting itself.
  strictEqual(missing.length, 1)

  // The single report lists every variable that is actually missing from the running configuration.
  for (const name of ['PLT_SOME_BASE_URL', 'PLT_SOME_CLIENT_ID', 'VALKEY_URL']) {
    strictEqual(missing[0].msg.includes(name), true, `expected ${name} in: ${missing[0].msg}`)
  }

  strictEqual(missing[0].msg.includes('fallback'), false)
})
