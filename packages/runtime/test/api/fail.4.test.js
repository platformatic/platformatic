import { rejects } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('does not wait forever if worker exits during api operation', async t => {
  const configFile = join(fixturesDir, 'configs', 'service-throws-on-start.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  await rejects(async () => {
    await app.start()
  }, /boom/)
})
