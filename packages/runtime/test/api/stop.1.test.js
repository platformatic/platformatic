import { strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should stop application by application id', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const applicationDetails = await app.getApplicationDetails('with-logger')
    strictEqual(applicationDetails.status, 'started')
  }

  await app.stopApplication('with-logger')

  {
    const applicationDetails = await app.getApplicationDetails('with-logger', true)
    strictEqual(applicationDetails.status, 'stopped')
  }
})
