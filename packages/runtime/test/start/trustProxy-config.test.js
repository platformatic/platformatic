import { equal } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('all applications have trustProxy = true in server config (except entrypoint)', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer.json')
  const app = await createRuntime(configFile)
  await app.start()
  const applications = await app.getApplications()

  for (const s of applications.applications) {
    const config = await app.getApplicationConfig(s.id)
    if (s.entrypoint) {
      equal(config.server.trustProxy, undefined)
    } else {
      equal(config.server.trustProxy, true)
    }
  }
  t.after(async () => {
    await app.close()
  })
})
