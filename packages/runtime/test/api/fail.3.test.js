import { fail, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should fail to start running application', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo', 'watt.config.mjs')
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

test('should fail to start running application after it was restarted', async t => {
  const configFile = join(fixturesDir, 'update-service-workers', 'watt.config.mjs')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Restarted workers get new indexes, the application is still running
  await app.restartApplication('node')
  const workers = (await app.getApplicationResourcesInfo('node')).workers

  try {
    await app.startApplication('node')
    fail('should have thrown')
  } catch (err) {
    strictEqual(err.message, 'Application is already started')
  }

  strictEqual((await app.getApplicationResourcesInfo('node')).workers, workers)
})
