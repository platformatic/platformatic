import { deepStrictEqual, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { prepareApplication } from '../index.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should not fail when adding an application and an existing worker has no message handlers', async t => {
  const configFile = join(fixturesDir, 'failed-init')
  const runtime = await createRuntime(configFile, null, { meshTimeout: 1000 })

  t.after(async () => {
    await runtime.close()
  })

  // Start the runtime
  const removedEvent = once(runtime, 'application:worker:event:mesh-removed')
  await runtime.start()

  await removedEvent

  // Add the second application. Since application-1 has no messages handlers anymore,
  // mesh setup will timeout but it is non-fatal (Promise.allSettled in undici-thread-interceptor).
  await runtime.addApplications(
    [
      await prepareApplication(runtime.getRuntimeConfig(true), {
        id: 'application-2',
        path: './application-2'
      })
    ],
    true
  )

  deepStrictEqual(runtime.getApplicationsIds(), ['application-1', 'application-2'])

  const details = await runtime.getApplicationDetails('application-2')
  strictEqual(details.status, 'started')
})
