import { deepStrictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { version } from '../../lib/version.js'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get application details', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const applicationDetails = await app.getApplicationDetails('with-logger')
  deepStrictEqual(applicationDetails, {
    id: 'with-logger',
    type: 'service',
    status: 'started',
    version,
    entrypoint: false,
    localUrl: 'http://with-logger.plt.local',
    dependencies: []
  })
})
