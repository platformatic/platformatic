import { rejects } from 'node:assert'
import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime, readLogs } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should correctly handle init errors', async t => {
  const configFile = join(fixturesDir, 'init-error', 'watt.config.mjs')

  const context = {}
  const runtime = await createRuntime(configFile, null, context)
  t.after(t => runtime.close())

  await rejects(
    () => runtime.init(),
    error => {
      strictEqual(error.code, 'PLT_RUNTIME_RUNTIME_ABORT')
      strictEqual(error.message, 'Unable to initialize the worker 0 of the application "main".')
      strictEqual(error.cause.code, 'PLT_RUNTIME_APPLICATION_EXIT')
      strictEqual(error.cause.message, 'The application "main:0" exited prematurely with error code 20')
      return true
    }
  )

  const logs = await readLogs(context.logsPath)

  deepStrictEqual(
    logs.filter(
      l => l.msg === 'The worker 0 of the application "main" threw an uncaught rejection before initialization.'
    ).length,
    6
  )
  deepStrictEqual(
    logs.filter(
      l =>
        l.msg ===
        'Failed to initialize the worker 0 of the application "main". Attempting to initialize a new worker ...'
    ).length,
    5
  )
})
