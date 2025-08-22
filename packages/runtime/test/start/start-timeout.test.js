import { rejects } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'
import { waitForEvents } from '../multiple-workers/helper.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('can start timeout when applications dont start', async t => {
  const configFile = join(fixturesDir, 'start-timeout/platformatic.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  const waitPromise = waitForEvents(
    app,
    { event: 'application:worker:starting', application: 'node', worker: 0 },
    { event: 'application:worker:startTimeout', application: 'node', worker: 0 }
  )

  await rejects(() => app.start())

  await app.stop()
  await waitPromise
})
