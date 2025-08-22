
import assert from 'node:assert'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

import {
  setUpEnvironment,
  startICC
} from './helper.js'
import { start } from '../index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

test('check that health is configured in runtime', async (t) => {
  const appName = 'test-health'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'runtime-health')

  const icc = await startICC(t, {
    applicationId
  })

  setUpEnvironment({
    PLT_APP_NAME: appName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000'
  })

  const app = await start()

  t.after(async () => {
    await app.close()
    await icc.close()
  })

  const runtimeConfig = await app.wattpro.runtime.getRuntimeConfig()

  assert.ok(runtimeConfig.health, 'Health configuration should be present')
  assert.strictEqual(runtimeConfig.health.enabled, true, 'Health monitoring should be enabled')
  assert.strictEqual(runtimeConfig.health.interval, 1000)
  assert.strictEqual(runtimeConfig.health.gracePeriod, 30000)
})
