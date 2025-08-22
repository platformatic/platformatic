import { fail, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should fail to start running application', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  try {
    await app.startApplication('with-logger')
    fail('should have thrown')
  } catch (err) {
    strictEqual(err.message, 'Application is already started')
  }
})
