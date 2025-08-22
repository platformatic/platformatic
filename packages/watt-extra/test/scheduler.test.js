
import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

import { randomUUID } from 'node:crypto'
import { start } from '../index.js'
import {
  setUpEnvironment,
  startICC,
  installDeps
} from './helper.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

test('should spawn a runtime disabling all the scheduler jobs', async (t) => {
  const applicationName = 'test-app'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'runtime-scheduler')

  await installDeps(t, applicationPath)

  let savedWattJob = null
  const icc = await startICC(t, {
    applicationId,
    applicationName,
    saveWattJob: (job) => {
      savedWattJob = job
    }
  })

  setUpEnvironment({
    PLT_APP_NAME: applicationName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000'
  })
  const app = await start()

  t.after(async () => {
    await app.close()
    await icc.close()
  })

  const config = await app.wattpro.runtime.getRuntimeConfig()

  const { scheduler } = config

  // The scheduler should be disabled
  const expectedSchedulerConfig = [{
    enabled: false,
    name: 'test',
    callbackUrl: 'http://localhost:3000',
    cron: '*/5 * * * *',
    method: 'GET',
    maxRetries: 3
  }]

  assert.deepStrictEqual(scheduler, expectedSchedulerConfig)

  // ICC is called to save the job
  const expectedWattJob = {
    name: 'test',
    callbackUrl: 'http://localhost:3000',
    schedule: '*/5 * * * *',
    method: 'GET',
    maxRetries: 3,
    applicationId
  }
  assert.deepEqual(savedWattJob, expectedWattJob)
})
