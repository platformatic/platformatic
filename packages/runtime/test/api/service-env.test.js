import { ok, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get application env when started', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)
  await app.start()

  t.after(async () => {
    await app.close()
  })

  const env = await app.getApplicationEnv('with-logger')
  ok(env)
  strictEqual(typeof env, 'object')
  // Runtime injects PLT_ENVIRONMENT into every worker
  ok(env.PLT_ENVIRONMENT)
})

test('getApplicationEnv throws ApplicationNotStarted when workers exist but are not started', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)
  await app.init()

  t.after(async () => {
    await app.close()
  })

  await rejects(
    () => app.getApplicationEnv('with-logger'),
    err => {
      strictEqual(err.code, 'PLT_RUNTIME_APPLICATION_NOT_STARTED')
      return true
    }
  )
})

test('getApplicationEnv throws WorkerNotFound after the application is stopped', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)
  await app.start()

  t.after(async () => {
    await app.close()
  })

  await app.stopApplication('with-logger')

  await rejects(
    () => app.getApplicationEnv('with-logger'),
    err => {
      strictEqual(err.code, 'PLT_RUNTIME_WORKER_NOT_FOUND')
      return true
    }
  )
})

test('getApplicationEnv throws ApplicationNotFound for unknown applications', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)
  await app.init()

  t.after(async () => {
    await app.close()
  })

  await rejects(
    () => app.getApplicationEnv('does-not-exist'),
    err => {
      strictEqual(err.code, 'PLT_RUNTIME_APPLICATION_NOT_FOUND')
      return true
    }
  )
})
