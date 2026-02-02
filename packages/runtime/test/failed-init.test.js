import { deepStrictEqual, rejects } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { prepareApplication } from '../index.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should restart an worker when it fails initialization', async t => {
  const configFile = join(fixturesDir, 'failed-init')
  const runtime = await createRuntime(configFile, null, { meshTimeout: 1000 })

  t.after(async () => {
    await runtime.close()
  })

  // Start the runtime
  const removedEvent = once(runtime, 'application:worker:event:mesh-removed')
  await runtime.start()

  await removedEvent

  // Add the second application. Since application-1 has no messages handlers anymore, mesh setup will always fail.
  const failedEvent = once(runtime, 'application:worker:init:failed')
  await rejects(async () => {
    return runtime.addApplications(
      [
        await prepareApplication(runtime.getRuntimeConfig(true), {
          id: 'application-2',
          path: './application-2'
        })
      ],
      true
    )
  })

  const [failed] = await failedEvent

  deepStrictEqual(failed, { application: 'application-2', worker: 0 })
})
