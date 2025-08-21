import { fail, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should fail to start application with a wrong id', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)
  await app.init()

  t.after(async () => {
    await app.close()
  })

  try {
    await app.startApplication('wrong-service-id')
    fail('should have thrown')
  } catch (err) {
    strictEqual(
      err.message,
      'Application wrong-service-id not found. Available applications are: db-app, serviceApp, with-logger, multi-plugin-service'
    )
  }
})
